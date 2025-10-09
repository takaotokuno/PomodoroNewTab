/**
 * Simplified unit tests for offscreen.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";

describe("Offscreen Audio Controller", () => {
  let chromeMock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    chromeMock = setupChromeMock();

    // Mock Audio constructor
    global.Audio = vi.fn().mockImplementation((src) => ({
      src,
      loop: false,
      volume: 1.0,
      currentTime: 0,
      paused: true,
      addEventListener: vi.fn((event, handler) => {
        if (event === "canplaythrough") {
          setTimeout(() => handler(), 10);
        }
      }),
      removeEventListener: vi.fn(),
      load: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }));

    // Mock window and console
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("console", {
      log: vi.fn(),
      error: vi.fn(),
    });

    // Mock chrome.runtime.getURL
    chromeMock.runtime.getURL.mockImplementation(
      (path) => `chrome-extension://test/${path}`
    );
  });

  test("should register message listener on import", async () => {
    await import("@/offscreen/offscreen.js");

    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  test("should handle PLAY message successfully", async () => {
    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "PLAY",
      soundFile: "resources/nature-sound.mp3",
      volume: 0.3,
      loop: true,
    };

    const result = messageListener(message, {}, mockSendResponse);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    expect(chromeMock.runtime.getURL).toHaveBeenCalledWith(
      "resources/nature-sound.mp3"
    );
    expect(global.Audio).toHaveBeenCalledWith(
      "chrome-extension://test/resources/nature-sound.mp3"
    );
  });

  test("should handle STOP message successfully", async () => {
    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "STOP",
    };

    const result = messageListener(message, {}, mockSendResponse);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test("should handle CLEANUP message successfully", async () => {
    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "CLEANUP",
    };

    const result = messageListener(message, {}, mockSendResponse);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test("should ignore non-AUDIO_CONTROL messages", async () => {
    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "OTHER_MESSAGE",
      action: "PLAY",
    };

    const result = messageListener(message, {}, mockSendResponse);

    expect(result).toBeUndefined();
    expect(mockSendResponse).not.toHaveBeenCalled();
  });

  test("should handle audio playback errors", async () => {
    // Mock Audio that throws error on play
    global.Audio = vi.fn().mockImplementation((src) => ({
      src,
      loop: false,
      volume: 1.0,
      addEventListener: vi.fn((event, handler) => {
        if (event === "canplaythrough") {
          setTimeout(() => handler(), 10);
        }
      }),
      removeEventListener: vi.fn(),
      load: vi.fn(),
      play: vi.fn().mockRejectedValue(new Error("Playback failed")),
      pause: vi.fn(),
    }));

    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "PLAY",
    };

    const result = messageListener(message, {}, mockSendResponse);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: false,
      error: "Playback failed",
    });
  });

  test("should handle audio load errors", async () => {
    // Mock Audio that triggers error event
    global.Audio = vi.fn().mockImplementation((src) => ({
      src,
      loop: false,
      volume: 1.0,
      addEventListener: vi.fn((event, handler) => {
        if (event === "error") {
          setTimeout(() => handler(new Error("Load failed")), 10);
        }
      }),
      removeEventListener: vi.fn(),
      load: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
    }));

    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "PLAY",
    };

    const result = messageListener(message, {}, mockSendResponse);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: false,
      error: "Audio file load failed",
    });
  });

  test("should use default parameters when not provided", async () => {
    await import("@/offscreen/offscreen.js");

    const messageListener =
      chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const mockSendResponse = vi.fn();

    const message = {
      type: "AUDIO_CONTROL",
      action: "PLAY",
    };

    messageListener(message, {}, mockSendResponse);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chromeMock.runtime.getURL).toHaveBeenCalledWith(
      "resources/nature-sound.mp3"
    );
    expect(global.Audio).toHaveBeenCalledWith(
      "chrome-extension://test/resources/nature-sound.mp3"
    );
  });
});
