/**
 * Unit tests for setup-alarms.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
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

    chromeMock.alarms.onAlarm.addListener.mockImplementation((fn) => {
      listener = fn;
    });

    // Import fresh modules after reset
    const setupAlarmsModule = await import("@/background/setup-alarms.js");
    setupAlarms = setupAlarmsModule.setupAlarms;
    startTick = setupAlarmsModule.startTick;
    stopTick = setupAlarmsModule.stopTick;
  });

  afterEach(() => {
    vi.clearAllMocks();
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
  });

  describe("startTick()", () => {
    test("should create repeating alarm with correct parameters", async () => {
      await startTick();

      expect(chromeMock.alarms.create).toHaveBeenCalledWith(TICK, {
        periodInMinutes: 1,
      });
    });
  });

  describe("stopTick()", () => {
    test("should clear the repeating alarm", async () => {
      await stopTick();

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith(TICK);
    });
  });
});
