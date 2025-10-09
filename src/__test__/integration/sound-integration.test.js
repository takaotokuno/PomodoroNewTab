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
      timer.start(25);
      timer.soundEnabled = true;
      timer.sessionType = SESSION_TYPES.WORK;

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
      timer.start(25);
      timer.soundEnabled = false;

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
      timer.start(25);
      timer.soundEnabled = true;
      timer.sessionType = SESSION_TYPES.BREAK;

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

  describe("Events Integration", () => {
    test("should save sound settings", async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      const { handleEvents } = await import("@/background/events.js");

      await handleEvents("sound/save", { isEnabled: true });

      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    test("should handle timer start with sound", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      const { handleEvents } = await import("@/background/events.js");
      const { getTimer } = await import("@/background/timer-store.js");

      await handleEvents("timer/start", { minutes: 25 });
      await handleEvents("sound/save", { isEnabled: true });

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.soundEnabled).toBe(true);
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
      timer.start(25);
      timer.soundEnabled = true;

      await handleSound();

      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Sound error (timer continues):",
        "Failed to send audio message: Sound error"
      );

      consoleSpy.mockRestore();
    });

    test("should handle offscreen setup failure", async () => {
      chromeMock.offscreen.createDocument.mockRejectedValue(
        new Error("Setup failed")
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSound } = await import("@/background/sound-controller.js");
      await setupSound();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to setup sound:",
        "Setup failed"
      );

      consoleSpy.mockRestore();
    });
  });
});
