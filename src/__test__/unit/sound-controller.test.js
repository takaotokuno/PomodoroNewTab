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
  soundVolume: 0.5,
  mode: TIMER_MODES.RUNNING,
  sessionType: SESSION_TYPES.WORK,
};
let currentTimer;

vi.mock("@/background/timer-store.js", () => ({
  getTimer: vi.fn(() => currentTimer),
}));

describe("SoundController", () => {
  let chromeMock;
  let handleSound, playAudio, stopAudio, setupSound, updateVolume;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    chromeMock = setupChromeMock();
    chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

    currentTimer = { ...mockTimer };

    const soundController = await import("@/background/sound-controller.js");
    ({ handleSound, playAudio, stopAudio, setupSound, updateVolume } =
      soundController);
  });

  describe("handleSound()", () => {
    test("should play audio when conditions are met", async () => {
      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "PLAY",
        soundFile: "resources/nature-sound.mp3",
        volume: mockTimer.soundVolume,
        loop: true,
      });
    });

    test("should stop audio when sound is disabled", async () => {
      currentTimer.soundEnabled = false;

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should stop audio when not in work session", async () => {
      currentTimer.sessionType = SESSION_TYPES.BREAK;

      await handleSound();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "STOP",
      });
    });

    test("should not play if already playing", async () => {
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
        volume: mockTimer.soundVolume,
        loop: true,
      });
    });

    test("should throw error when sendMessage fails", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(new Error("Send error"));

      await expect(playAudio()).rejects.toThrow(
        "Failed to send audio message: Send error"
      );
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

  describe("updateVolume()", () => {
    test("should send UPDATE_VOLUME message when audio is playing", async () => {
      await playAudio();
      chromeMock.runtime.sendMessage.mockClear();

      currentTimer.soundVolume = 0.8;
      await updateVolume();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "AUDIO_CONTROL",
        action: "UPDATE_VOLUME",
        volume: 0.8,
      });
    });

    test("should not send message when audio is not playing", async () => {
      await updateVolume();

      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("setupSound()", () => {
    test("should create offscreen document only once", async () => {
      await setupSound();

      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledTimes(1);
      expect(chromeMock.offscreen.createDocument).toHaveBeenCalledWith({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing background audio for pomodoro timer",
      });
    });

    test("should not create offscreen document if already created", async () => {
      chromeMock.runtime.getContexts = vi.fn().mockResolvedValue([
        {
          contextType: "OFFSCREEN_DOCUMENT",
          documentUrl:
            "chrome-extension://test-id/src/offscreen/offscreen.html",
        },
      ]);

      await setupSound();

      expect(chromeMock.offscreen.createDocument).not.toHaveBeenCalled();
    });
  });
});
