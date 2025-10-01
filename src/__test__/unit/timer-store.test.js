/**
 * Unit tests for timer-store.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome";

const SNAPSHOT_KEY = "pomodoroTimerSnapshot";

beforeEach(() => {
  setupChromeMock();
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("initTimer", async () => {
  const { initTimer } = await import("@/background/timer-store.js");

  test("restores a new timer instance when no snapshot exists", async () => {
    const timer = await initTimer();
    // `chrome.storage.local.get` is called with the snapshot key
    expect(globalThis.chrome.storage.local.get).toHaveBeenCalledWith(
      SNAPSHOT_KEY
    );

    // initTImer should return a TimerState instance
    expect(timer).toBeTruthy();

    // default state should be inactive
    expect(timer.isActive).toBe(false);
  });

  test("reuses the same instance when called multiple times", async () => {
    let timer = await initTimer();
    timer.start();

    timer = await initTimer();

    // instance should persist its state
    expect(timer.isActive).toBe(true);
  });

  test("restores timer state from an existing snapshot", async () => {
    chrome.storage.local.get.mockResolvedValue({
      [SNAPSHOT_KEY]: { isActive: true },
    });

    let timer = await initTimer();

    expect(timer.isActive).toBe(true);
  });
});

describe("getTimer", () => {
  test("throws an error if initTimer has not been called", async () => {
    const { getTimer } = await import("@/background/timer-store.js");

    expect(() => getTimer()).toThrow("Timer not initialized");
  });

  test("returns the existing timer after initialization", async () => {
    const { initTimer, getTimer } = await import("@/background/timer-store.js");

    await initTimer();
    const timer = await getTimer();

    expect(timer).toBeTruthy();
  });
});

describe("saveSnapshot", () => {
  test("does nothing if no timer instance exists", async () => {
    const { saveSnapshot } = await import("@/background/timer-store.js");
    await saveSnapshot();

    // no set operation should be performed
    expect(globalThis.chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test("saves the snapthot of the current timer state", async () => {
    const { initTimer, saveSnapshot } = await import(
      "@/background/timer-store.js"
    );
    let timer = await initTimer();
    timer.start();
    await saveSnapshot();

    expect(globalThis.chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SNAPSHOT_KEY]: expect.any(Object),
      })
    );
  });
});
