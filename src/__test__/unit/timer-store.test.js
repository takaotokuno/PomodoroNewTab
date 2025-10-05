/**
 * Unit tests for timer-store.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";

const { TIMER_MODES } = Constants;

// Mock TimerState
const mockTimerInstance = {
  mode: TIMER_MODES.SETUP,
  toSnapshot: vi.fn(),
};

const MockTimerState = vi.fn(() => mockTimerInstance);
MockTimerState.fromSnapshot = vi.fn((snap) => {
  if (!snap) return mockTimerInstance;
  return { ...mockTimerInstance, mode: snap.mode || TIMER_MODES.SETUP };
});

vi.mock("@/timer-state.js", () => ({
  default: MockTimerState,
}));

describe("TimerStore", () => {
  const SNAPSHOT_KEY = "pomodoroTimerSnapshot";

  let chromeMock = setupChromeMock();
  let initTimer, getTimer, saveSnapshot;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock timer instance
    mockTimerInstance.mode = TIMER_MODES.SETUP;
    mockTimerInstance.toSnapshot.mockReturnValue({ mode: TIMER_MODES.SETUP });

    // Import fresh modules after reset
    const timerStore = await import("@/background/timer-store.js");
    initTimer = timerStore.initTimer;
    getTimer = timerStore.getTimer;
    saveSnapshot = timerStore.saveSnapshot;
  });

  describe("initTimer()", () => {
    test("should call chrome.storage.local.get with correct key", async () => {
      await initTimer();

      expect(chromeMock.storage.local.get).toHaveBeenCalledWith(SNAPSHOT_KEY);
    });

    test("should create new TimerState when no snapshot exists", async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const timer = await initTimer();

      expect(MockTimerState).toHaveBeenCalled();
      expect(MockTimerState.fromSnapshot).not.toHaveBeenCalled();
      expect(timer).toBe(mockTimerInstance);
    });

    test("should reuse the same instance when called multiple times", async () => {
      const timer1 = await initTimer();
      const timer2 = await initTimer();

      expect(timer1).toBe(timer2);
      expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(1);
    });

    test("should restore timer from snapshot when snapshot exists", async () => {
      const mockSnapshot = { mode: TIMER_MODES.RUNNING };
      chromeMock.storage.local.get.mockResolvedValue({
        [SNAPSHOT_KEY]: mockSnapshot,
      });

      const timer = await initTimer();

      expect(MockTimerState.fromSnapshot).toHaveBeenCalledWith(mockSnapshot);
      expect(timer).toBeTruthy();
    });

    test("should handle chrome.storage.local.get errors", async () => {
      chromeMock.storage.local.get.mockRejectedValue(
        new Error("Storage error")
      );

      await expect(initTimer()).rejects.toThrow("Storage error");
    });

    test("should create new TimerState when snapshot is null", async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [SNAPSHOT_KEY]: null,
      });

      await initTimer();

      expect(MockTimerState).toHaveBeenCalled();
      expect(MockTimerState.fromSnapshot).not.toHaveBeenCalled();
    });

    test("should create new TimerState when snapshot is undefined", async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [SNAPSHOT_KEY]: undefined,
      });

      await initTimer();

      expect(MockTimerState).toHaveBeenCalled();
      expect(MockTimerState.fromSnapshot).not.toHaveBeenCalled();
    });
  });

  describe("getTimer()", () => {
    test("should throw error if timer not initialized", () => {
      expect(() => getTimer()).toThrow("Timer not initialized");
    });

    test("should return timer instance after initialization", async () => {
      await initTimer();
      const timer = getTimer();

      expect(timer).toBe(mockTimerInstance);
    });

    test("should return same instance as initTimer", async () => {
      const timer1 = await initTimer();
      const timer2 = getTimer();

      expect(timer1).toBe(timer2);
    });
  });

  describe("saveSnapshot()", () => {
    test("should do nothing if no timer instance exists", async () => {
      await saveSnapshot();

      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    });

    test("should call toSnapshot on timer instance", async () => {
      await initTimer();
      mockTimerInstance.toSnapshot.mockReturnValue({
        mode: TIMER_MODES.RUNNING,
      });

      await saveSnapshot();

      expect(mockTimerInstance.toSnapshot).toHaveBeenCalled();
    });

    test("should save snapshot to chrome.storage.local", async () => {
      await initTimer();
      const mockSnapshot = { mode: TIMER_MODES.RUNNING };
      mockTimerInstance.toSnapshot.mockReturnValue(mockSnapshot);

      await saveSnapshot();

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [SNAPSHOT_KEY]: mockSnapshot,
      });
    });

    test("should handle chrome.storage.local.set errors", async () => {
      chromeMock.storage.local.set.mockRejectedValue(
        new Error("Storage write error")
      );

      await initTimer();
      mockTimerInstance.toSnapshot.mockReturnValue({ mode: TIMER_MODES.SETUP });

      await expect(saveSnapshot()).rejects.toThrow("Storage write error");
    });
  });
});
