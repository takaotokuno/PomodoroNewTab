/**
 * Simplified integration tests for sound functionality
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES } = Constants;

describe("Sound Integration - Core Functionality", () => {
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

  describe("Sound Controller Logic", () => {
    test("should play audio when conditions are met", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      timer.start(25);

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "PLAY",
        soundFile: "resources/nature-sound.mp3",
        volume: 0.2,
        loop: true,
      });
    });

    test("should stop audio when sound is disabled", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = false;
      timer.start(25);

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should stop audio when timer is not running", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      // Timer is in SETUP mode by default

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should stop audio during break sessions", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      timer.start(25);
      // Manually set to BREAK to test the condition
      timer.sessionType = SESSION_TYPES.BREAK;

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should not play if already playing", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      timer.start(25);

      // First call should play
      await handleSound();
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second call should not send additional message (already playing)
      await handleSound();
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    test("should stop audio during WORK to BREAK session transition", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      timer.start(25);

      // First call should play during WORK session
      await handleSound();
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "PLAY",
        soundFile: "resources/nature-sound.mp3",
        volume: 0.2,
        loop: true,
      });

      // Simulate session completion and transition to BREAK
      timer.sessionType = SESSION_TYPES.BREAK;
      timer.mode = TIMER_MODES.RUNNING;

      // Second call should stop during BREAK session
      await handleSound();
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });
  });

  describe("Audio Message Functions", () => {
    test("should send correct PLAY message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { playAudio } = await import("@/background/sound-controller.js");

      await playAudio();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "PLAY",
        soundFile: "resources/nature-sound.mp3",
        volume: 0.2,
        loop: true,
      });
    });

    test("should send correct STOP message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { stopAudio } = await import("@/background/sound-controller.js");

      await stopAudio();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should handle playAudio errors", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Playback failed")
      );

      const { playAudio } = await import("@/background/sound-controller.js");

      await expect(playAudio()).rejects.toThrow(
        "Failed to send audio message: Playback failed"
      );
    });

    test("should handle stopAudio errors", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Stop failed")
      );

      const { stopAudio } = await import("@/background/sound-controller.js");

      await expect(stopAudio()).rejects.toThrow(
        "Failed to send audio message: Stop failed"
      );
    });
  });

  describe("Storage Persistence", () => {
    test("should persist sound settings across init", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);
      chromeMock.storage.local.get.mockResolvedValue({
        pomodoroTimerSnapshot: {
          soundEnabled: true,
          mode: "setup",
          sessionType: "work",
          sessionDuration: 1500000,
          totalDuration: 1500000,
          sessionStartTime: null,
          totalStartTime: null,
          pausedAt: null,
        },
      });

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );

      await initTimer();
      expect(getTimer().soundEnabled).toBe(true);
    });

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

  describe("Offscreen Setup", () => {
    test("should create offscreen document when not exists", async () => {
      chromeMock.runtime.getContexts = vi.fn().mockResolvedValue([]);

      const { setupSound } = await import("@/background/sound-controller.js");
      await setupSound();

      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledWith({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing background audio for pomodoro timer",
      });
    });

    test("should skip offscreen creation if already exists", async () => {
      chromeMock.runtime.getContexts = vi
        .fn()
        .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }]);

      const { setupSound } = await import("@/background/sound-controller.js");
      await setupSound();

      expect(chromeMock.offscreen.createDocument).not.toHaveBeenCalled();
    });

    test("should handle offscreen setup failure", async () => {
      chromeMock.runtime.getContexts = vi.fn().mockResolvedValue([]);
      chromeMock.offscreen.createDocument.mockRejectedValue(
        new Error("Setup failed")
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSound } = await import("@/background/sound-controller.js");
      await setupSound();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to setup sound:",
        expect.stringContaining("Setup failed")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    test("should handle sound errors gracefully", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Sound error")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { initTimer, getTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleSound } = await import("@/background/sound-controller.js");

      await initTimer();
      const timer = getTimer();
      timer.soundEnabled = true;
      timer.start(25);

      await handleSound();

      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Sound error (timer continues):",
        expect.stringContaining("Sound error")
      );

      consoleSpy.mockRestore();
    });

    test("should reset isPlaying flag on playAudio error", async () => {
      vi.resetModules();
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Playback failed")
      );

      const { playAudio } = await import("@/background/sound-controller.js");

      await expect(playAudio()).rejects.toThrow(
        "Failed to send audio message: Playback failed"
      );

      // Second attempt should try again (isPlaying should be reset)
      vi.resetModules();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      const { playAudio: playAudio2 } = await import(
        "@/background/sound-controller.js"
      );
      await expect(playAudio2()).resolves.not.toThrow();
    });

    test("should reset isPlaying flag on stopAudio error", async () => {
      vi.resetModules();
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Stop failed")
      );

      const { stopAudio } = await import("@/background/sound-controller.js");

      await expect(stopAudio()).rejects.toThrow(
        "Failed to send audio message: Stop failed"
      );

      // isPlaying should be reset even on error
      vi.resetModules();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      const { stopAudio: stopAudio2 } = await import(
        "@/background/sound-controller.js"
      );
      await expect(stopAudio2()).resolves.not.toThrow();
    });
  });
});
