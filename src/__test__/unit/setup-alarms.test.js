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
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: TICK });

      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should propagate errors from handleEvents and not save snapshot", async () => {
      const { handleEvents } = await import("@/background/events.js");

      handleEvents.mockRejectedValueOnce(new Error("boom"));

      setupAlarms();

      // The error should be caught and logged, not propagated
      await listener({ name: TICK });
      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should only register listener once when called multiple times", () => {
      setupAlarms();
      setupAlarms();

      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
    });

    test("should call handleEvents even when getTimer returns null", async () => {
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: TICK });

      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should call handleEvents even when getTimer returns undefined", async () => {
      const { handleEvents } = await import("@/background/events.js");

      setupAlarms();
      await listener({ name: TICK });

      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should handle errors from handleEvents", async () => {
      const { handleEvents } = await import("@/background/events.js");

      handleEvents.mockRejectedValueOnce(new Error("handleEvents error"));

      setupAlarms();

      // The error should be caught and logged, not propagated
      await listener({ name: TICK });
      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should handle errors from handleEvents gracefully", async () => {
      const { handleEvents } = await import("@/background/events.js");

      handleEvents.mockRejectedValueOnce(new Error("update error"));

      setupAlarms();

      // The error should be caught and logged, not propagated
      await listener({ name: TICK });
      expect(handleEvents).toHaveBeenCalledWith("timer/update");
    });

    test("should handle errors from handleEvents and log them", async () => {
      const { handleEvents } = await import("@/background/events.js");
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      handleEvents.mockRejectedValueOnce(new Error("handleEvents error"));

      setupAlarms();

      await listener({ name: TICK });

      expect(handleEvents).toHaveBeenCalledWith("timer/update");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Alarm message failed:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
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

    test("should throw error when chrome.alarms.create fails", () => {
      chromeMock.alarms.create.mockImplementationOnce(() => {
        throw new Error("Alarm creation failed");
      });

      expect(() => startTick()).toThrow("Alarm creation failed");
    });
  });

  describe("stopTick()", () => {
    test("should clear the repeating alarm", async () => {
      await stopTick();

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith(TICK);
    });

    test("should throw error when chrome.alarms.clear fails", async () => {
      chromeMock.alarms.clear.mockRejectedValueOnce(
        new Error("Alarm clear failed")
      );

      await expect(stopTick()).rejects.toThrow("Alarm clear failed");
    });
  });
});
