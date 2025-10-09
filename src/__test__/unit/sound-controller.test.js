/**
 * Unit tests for sound-controller.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES } = Constants;

// Mock timer-store
const mockTimer = {
  soundEnabled: true,
  mode: TIMER_MODES.RUNNING,
  sessionType: SESSION_TYPES.WORK,
};

vi.mock("@/background/timer-store.js", () => ({
  getTimer: vi.fn(() => mockTimer),
}));

describe("SoundController", () => {
  let chromeMock;
  let handleSound, playAudio, stopAudio, setupSound;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    chromeMock = setupChromeMock();
    chromeMock.offscreen = {
      createDocument: vi.fn().mockResolvedValue(undefined),
    };

    // Reset mock timer state
    Object.assign(mockTimer, {
      soundEnabled: true,
      mode: TIMER_MODES.RUNNING,
      sessionType: SESSION_TYPES.WORK,
    });

    const soundController = await import("@/background/sound-controller.js");
    ({ handleSound, playAudio, stopAudio, setupSound } = soundController);
  });

  describe("handleSound()", () => {
    test("should play audio when conditions are met", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

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
      mockTimer.soundEnabled = false;
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should stop audio when not in work session", async () => {
      mockTimer.sessionType = SESSION_TYPES.BREAK;
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should not play if already playing", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await handleSound();
      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("playAudio()", () => {
    test("should send correct PLAY message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await playAudio();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "PLAY",
        soundFile: "resources/nature-sound.mp3",
        volume: 0.2,
        loop: true,
      });
    });

    test("should handle errors", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(new Error("Send error"));

      await expect(playAudio()).rejects.toThrow("Failed to send audio message");
    });
  });

  describe("stopAudio()", () => {
    test("should send STOP message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await stopAudio();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });
  });

  describe("setupSound()", () => {
    test("should create offscreen document", async () => {
      await setupSound();

      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledWith({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing background audio for pomodoro timer",
      });
    });
  });
});
