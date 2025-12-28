/**
 * End-to-end tests for sound functionality
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { BGClient } from "@/ui/bg-client.js";
import { handleEvents } from "@/background/events.js";
import { initTimer, getTimer } from "@/background/timer-store.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES } = Constants;

vi.stubGlobal("alert", vi.fn());
let isPlaying = false;

describe("Sound End-to-End Tests", () => {
  let chromeMock;
  let bgClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();
    await initTimer();
    bgClient = new BGClient();

    chromeMock.runtime.sendMessage.mockImplementation(async (msg) => {
      if (msg.type === "AUDIO_CONTROL") {
        if (msg.action === "PLAY") isPlaying = true;
        else if (msg.action === "STOP") isPlaying = false;
        return { success: true };
      }

      try {
        let data = await handleEvents(msg.type, msg);
        if (!data) data = { success: true };
        else if ("success" in data === false) data.success = true;
        return data;
      } catch (e) {
        return {
          success: false,
          severity: "fatal",
          error: String(e?.message || e),
        };
      }
    });

    // Mock DOM
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => ({ addEventListener: vi.fn() })),
      addEventListener: vi.fn(),
      visibilityState: "visible",
    });

    // Mock intervals - fix unused variables
    vi.stubGlobal(
      "setInterval",
      vi.fn(() => 123)
    );
    vi.stubGlobal("clearInterval", vi.fn());

    await initTimer();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Complete User Workflows", () => {
    test("should handle complete timer session with sound", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      // Enable sound and start timer
      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 80});
      await bgClient.start(25);

      const timer = getTimer();
      expect(timer.soundEnabled).toBe(true);
      expect(timer.soundVolume).toBe(80);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(isPlaying).toBe(true);

      // Test pause/resume cycle
      await bgClient.pause();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(isPlaying).toBe(false);

      await bgClient.resume();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(isPlaying).toBe(true);

      // Reset and verify sound settings persist
      await bgClient.reset();
      expect(timer.mode).toBe(TIMER_MODES.SETUP);
      expect(timer.soundEnabled).toBe(true);
      expect(timer.soundVolume).toBe(80);
      expect(isPlaying).toBe(false);
    });

    test("should stop sound when paused", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 60});
      await bgClient.start(25);
      expect(isPlaying).toBe(true);

      await bgClient.pause();
      expect(isPlaying).toBe(false);
      expect(getTimer().soundEnabled).toBe(true); // Setting persists
      expect(getTimer().soundVolume).toBe(60); // Volume persists
    });

    test("should not play sound when disabled from start", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await bgClient.saveSoundSettings({soundEnabled: false, soundVolume: 0});
      await bgClient.start(25);

      expect(getTimer().soundEnabled).toBe(false);
      expect(getTimer().soundVolume).toBe(0);
      expect(isPlaying).toBe(false);
    });

    test("should save sound settings via events integration", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 90});

      // Verify storage was called (snapshot includes soundEnabled and soundVolume)
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
      const callArg = chromeMock.storage.local.set.mock.calls[0][0];
      expect(callArg.pomodoroTimerSnapshot.soundEnabled).toBe(true);
      expect(callArg.pomodoroTimerSnapshot.soundVolume).toBe(90);

      const timer = getTimer();
      expect(timer.soundEnabled).toBe(true);
      expect(timer.soundVolume).toBe(90);
    });

    test("should handle volume validation in e2e flow", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      // Test valid volume range
      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 50});
      expect(getTimer().soundVolume).toBe(50);

      // Test edge cases
      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 0});
      expect(getTimer().soundVolume).toBe(0);

      await bgClient.saveSoundSettings({soundEnabled: true, soundVolume: 100});
      expect(getTimer().soundVolume).toBe(100);
    });
  });
});
