/**
 * Unit tests for setup-alarms.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";

// Mock timer-store
const mockTimer = {
  update: vi.fn().mockReturnValue({ any: "sentinel" }),
};

vi.mock("@/background/timer-store.js", () => ({
  getTimer: vi.fn(() => mockTimer),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  __mockTimer: mockTimer,
}));

// Mock events
vi.mock("@/background/events.js", () => ({
  handleEvents: vi.fn().mockResolvedValue(undefined),
}));

describe("SetupAlarms", () => {
  const TICK = "POMODORO_TICK";

  let chromeMock = setupChromeMock();
  let listener;
  let setupAlarms, startTick, stopTick;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    chromeMock.alarms.onAlarm.addListener.mockImplementation((fn) => {
      listener = fn;
    });

    // Import fresh modules after reset
    const setupAlarmsModule = await import("@/background/setup-alarms.js");
    setupAlarms = setupAlarmsModule.setupAlarms;
    startTick = setupAlarmsModule.startTick;
    stopTick = setupAlarmsModule.stopTick;
  });

  describe("setupAlarms()", () => {
    test("should register alarm listener", () => {
      setupAlarms();

      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
      expect(typeof listener).toBe("function");
    });

    test("should ignore alarms with different name", async () => {
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: "OTHER_TICK" });

      expect(handleEvents).not.toHaveBeenCalled();
    });

    test("should handle POMODORO_TICK flow in correct order", async () => {
      const { getTimer, saveSnapshot, __mockTimer } = await import(
        "@/background/timer-store.js"
      );
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: TICK });

      expect(getTimer).toHaveBeenCalled();
      expect(__mockTimer.update).toHaveBeenCalled();

      const updateResult = __mockTimer.update.mock.results[0].value;
      expect(handleEvents).toHaveBeenCalledWith(updateResult);
      expect(saveSnapshot).toHaveBeenCalled();
    });

    test("should propagate errors from handleEvents and not save snapshot", async () => {
      const { saveSnapshot } = await import("@/background/timer-store.js");
      const { handleEvents } = await import("@/background/events.js");

      handleEvents.mockRejectedValueOnce(new Error("boom"));

      setupAlarms();

      await expect(listener({ name: TICK })).rejects.toThrow("boom");
      expect(saveSnapshot).not.toHaveBeenCalled();
    });

    test("should only register listener once when called multiple times", () => {
      setupAlarms();
      setupAlarms();

      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
    });

    test("should return early when getTimer returns null", async () => {
      const { getTimer } = await import("@/background/timer-store.js");
      const { handleEvents } = await import("@/background/events.js");

      getTimer.mockReturnValueOnce(null);

      setupAlarms();
      await listener({ name: TICK });

      expect(getTimer).toHaveBeenCalled();
      expect(handleEvents).not.toHaveBeenCalled();
    });

    test("should return early when getTimer returns undefined", async () => {
      const { getTimer } = await import("@/background/timer-store.js");
      const { handleEvents } = await import("@/background/events.js");

      getTimer.mockReturnValueOnce(undefined);

      setupAlarms();
      await listener({ name: TICK });

      expect(getTimer).toHaveBeenCalled();
      expect(handleEvents).not.toHaveBeenCalled();
    });

    test("should propagate errors from getTimer", async () => {
      const { getTimer } = await import("@/background/timer-store.js");

      getTimer.mockImplementationOnce(() => {
        throw new Error("getTimer error");
      });

      setupAlarms();

      await expect(listener({ name: TICK })).rejects.toThrow("getTimer error");
    });

    test("should propagate errors from timer.update", async () => {
      const { __mockTimer } = await import("@/background/timer-store.js");

      __mockTimer.update.mockImplementationOnce(() => {
        throw new Error("update error");
      });

      setupAlarms();

      await expect(listener({ name: TICK })).rejects.toThrow("update error");
    });

    test("should propagate errors from saveSnapshot and not call it after handleEvents error", async () => {
      const { saveSnapshot } = await import("@/background/timer-store.js");
      const { handleEvents } = await import("@/background/events.js");

      handleEvents.mockRejectedValueOnce(new Error("handleEvents error"));

      setupAlarms();

      await expect(listener({ name: TICK })).rejects.toThrow(
        "handleEvents error"
      );
      expect(saveSnapshot).not.toHaveBeenCalled();
    });

    test("should handle alarm object without name property", async () => {
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({});

      expect(handleEvents).not.toHaveBeenCalled();
    });

    test("should handle alarm object with null name", async () => {
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: null });

      expect(handleEvents).not.toHaveBeenCalled();
    });
  });

  describe("startTick()", () => {
    test("should create repeating alarm with correct parameters", () => {
      startTick();

      expect(chromeMock.alarms.create).toHaveBeenCalledWith(TICK, {
        periodInMinutes: 1,
      });
    });

    test("should handle chrome.alarms.create errors", () => {
      chromeMock.alarms.create.mockImplementationOnce(() => {
        throw new Error("Alarm creation failed");
      });

      expect(() => startTick()).toThrow("Alarm creation failed");
    });
  });

  describe("stopTick()", () => {
    test("should clear the repeating alarm", () => {
      stopTick();

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith(TICK);
    });

    test("should handle chrome.alarms.clear errors", () => {
      chromeMock.alarms.clear.mockImplementationOnce(() => {
        throw new Error("Alarm clear failed");
      });

      expect(() => stopTick()).toThrow("Alarm clear failed");
    });
  });
});
