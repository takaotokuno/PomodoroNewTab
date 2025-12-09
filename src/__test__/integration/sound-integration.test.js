/**
 * Integration tests for sound functionality through handleEvents
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";

const { TIMER_MODES } = Constants;

describe("Sound Integration - handleEvents Flow", () => {
  let chromeMock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    chromeMock = setupChromeMock();

    // Mock offscreen API
    chromeMock.offscreen = {
      createDocument: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("Sound through timer events", () => {
    test("should handle sound when starting timer with sound enabled", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      // Enable sound first
      await handleEvents("sound/save", { isEnabled: true });

      // Start timer - should trigger handleSound
      await handleEvents("timer/start", { minutes: 25 });

      const timer = getTimer();
      expect(timer.soundEnabled).toBe(true);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Sound should be playing during work session
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUDIO_CONTROL",
          action: "PLAY",
        })
      );
    });

    test("should not play sound when disabled", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");

      // Disable sound
      await handleEvents("sound/save", { isEnabled: false });

      // Start timer
      await handleEvents("timer/start", { minutes: 25 });

      // Sound should be stopped
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUDIO_CONTROL",
          action: "STOP",
        })
      );
    });

    test("should stop sound when pausing timer", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");

      await handleEvents("sound/save", { isEnabled: true });
      await handleEvents("timer/start", { minutes: 25 });

      vi.clearAllMocks();

      // Pause timer - should stop sound
      await handleEvents("timer/pause");

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUDIO_CONTROL",
          action: "STOP",
        })
      );
    });

    test("should handle sound during timer update", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      await handleEvents("sound/save", { isEnabled: true });
      await handleEvents("timer/start", { minutes: 25 });

      vi.clearAllMocks();

      // Update timer - should maintain sound state
      const result = await handleEvents("timer/update");

      expect(result.success).toBe(true);
      expect(getTimer().soundEnabled).toBe(true);
    });
  });

  describe("Sound settings persistence", () => {
    test("should save and apply sound settings through events", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      // Save sound enabled
      const result = await handleEvents("sound/save", { isEnabled: true });

      expect(result.success).toBe(true);
      expect(result.soundEnabled).toBe(true);
      expect(getTimer().soundEnabled).toBe(true);
    });

    test("should toggle sound settings", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      // Enable sound
      await handleEvents("sound/save", { isEnabled: true });
      expect(getTimer().soundEnabled).toBe(true);

      // Disable sound
      await handleEvents("sound/save", { isEnabled: false });
      expect(getTimer().soundEnabled).toBe(false);
    });
  });

  describe("Concurrent operations", () => {
    test("should handle concurrent save operations", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleEvents } = await import("@/background/events.js");

      await initTimer();

      await Promise.all([
        handleEvents("sound/save", { isEnabled: true }),
        handleEvents("timer/start", { minutes: 25 }),
      ]);

      const timer = getTimer();
      expect(timer.soundEnabled).toBe(true);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
    });
  });

  describe("Error Handling through events", () => {
    test("should return warning when sound fails but timer continues", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Sound error")
      );

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      await handleEvents("sound/save", { isEnabled: true });

      // Start timer - sound will fail but timer should continue
      const result = await handleEvents("timer/start", { minutes: 25 });

      // Timer should still be running despite sound error
      expect(getTimer().mode).toBe(TIMER_MODES.RUNNING);

      // Result should indicate warning (non-fatal error)
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.WARNING);
      expect(result.error).toContain("Failed to send audio message: Sound error");
    });

    test("should handle sound error during pause", async () => {
      chromeMock.runtime.sendMessage
        .mockResolvedValueOnce({ success: true }) // sound/save
        .mockResolvedValueOnce({ success: true }) // timer/start
        .mockRejectedValueOnce(new Error("Stop failed")); // timer/pause

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      await handleEvents("sound/save", { isEnabled: true });
      await handleEvents("timer/start", { minutes: 25 });

      // Pause with sound error
      const result = await handleEvents("timer/pause");

      // Timer should still be paused
      expect(getTimer().mode).toBe(TIMER_MODES.PAUSED);

      // Should return warning
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.WARNING);
    });
  });
});
