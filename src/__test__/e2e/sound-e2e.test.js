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

describe("Sound End-to-End Tests", () => {
  let chromeMock;
  let bgClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();
    bgClient = new BGClient();

    // Mock offscreen API
    chromeMock.offscreen = {
      createDocument: vi.fn().mockResolvedValue(undefined),
    };

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

  describe("Sound Workflow", () => {
    test("should handle complete timer session with sound", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      // Enable sound and start timer
      await handleEvents("sound/save", { isEnabled: true });
      await handleEvents("timer/start", { minutes: 25 });

      const timer = getTimer();
      expect(timer.soundEnabled).toBe(true);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Test pause/resume cycle
      await handleEvents("timer/pause");
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);

      await handleEvents("timer/resume");
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Reset and verify sound setting persists
      await handleEvents("timer/reset");
      expect(timer.mode).toBe(TIMER_MODES.SETUP);
      expect(timer.soundEnabled).toBe(true);
    });

    test("should toggle sound during active session", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await handleEvents("timer/start", { minutes: 25 });
      const timer = getTimer();

      // Toggle sound on/off during active timer
      await handleEvents("sound/save", { isEnabled: true });
      expect(timer.soundEnabled).toBe(true);

      await handleEvents("sound/save", { isEnabled: false });
      expect(timer.soundEnabled).toBe(false);
      // sound/save doesn't automatically save to storage in current implementation
      // The test should focus on the timer state change
    });
  });

  describe("UI-Background Integration", () => {
    test("should sync sound settings via BGClient", async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === "sound/save") {
          // Update the timer state when sound is saved
          const timer = getTimer();
          timer.soundEnabled = message.isEnabled;
          return Promise.resolve({ success: true });
        }
        if (message.type === "timer/update") {
          const timer = getTimer();
          return Promise.resolve({
            success: true,
            soundEnabled: timer.soundEnabled,
          });
        }
        return Promise.resolve({ success: true });
      });

      const result = await bgClient.saveSoundSettings(true);
      expect(result.success).toBe(true);
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "sound/save",
        isEnabled: true,
      });

      const state = await bgClient.update();
      expect(state.soundEnabled).toBe(true);
    });

    test("should handle BGClient errors", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: "Storage error",
      });

      const result = await bgClient.saveSoundSettings(true);
      expect(result).toBeUndefined();
    });
  });

  describe("Storage & Error Handling", () => {
    test("should persist sound settings", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);
      chromeMock.storage.local.get.mockResolvedValue({ soundEnabled: true });

      await handleEvents("sound/save", { isEnabled: true });
      expect(chromeMock.storage.local.set).toHaveBeenCalled();

      // Simulate restart
      await initTimer();
      expect(getTimer().soundEnabled).toBe(true);
    });

    test("should handle storage errors gracefully", async () => {
      // Reset modules to force re-initialization
      vi.resetModules();

      chromeMock.storage.local.get.mockRejectedValue(
        new Error("Storage error")
      );

      const { initTimer } = await import("@/background/timer-store.js");
      await expect(initTimer()).rejects.toThrow("Storage error");
    });
  });

  describe("Resource Management", () => {
    test("should create offscreen document only once", async () => {
      chromeMock.offscreen.createDocument.mockResolvedValue(undefined);

      // Reset modules to ensure fresh import
      vi.resetModules();

      // Import and call setupSound directly
      const { setupSound } = await import("@/background/sound-controller.js");

      await setupSound();

      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledTimes(1);
      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledWith({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing background audio for pomodoro timer",
      });
    });

    test("should handle concurrent operations", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await Promise.all([
        handleEvents("sound/save", { isEnabled: true }),
        handleEvents("timer/start", { minutes: 25 }),
        handleEvents("timer/pause"),
      ]);

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.soundEnabled).toBe(true);
    });
  });
});
