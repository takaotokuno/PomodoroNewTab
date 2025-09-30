/**
 * Unit tests for alarms.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome";

//
vi.mock("@/background/timer-store.js", () => {
  const fakeTimer = { update: vi.fn().mockReturnValue({ any: "sentinel" }) };
  return {
    initTimer: vi.fn().mockResolvedValue(undefined),
    getTimer: vi.fn(() => fakeTimer),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    __fakeTimer: fakeTimer,
  };
});
vi.mock("@/background/events.js", () => {
  return {
    handleUpdateResult: vi.fn().mockResolvedValue(undefined),
  };
});

let alarms;
let listener;
const TICK = "POMODORO_TICK";

beforeEach(async () => {
  vi.resetModules();
  ({ alarms } = setupChromeMock());

  alarms.onAlarm.addListener.mockImplementation((fn) => {
    listener = fn;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setupAlarms", () => {
  test("registers a repeating alarm with the correct name and period", async () => {
    const { setupAlarms } = await import("@/background/setup-alarms.js");

    setupAlarms();

    expect(alarms.create).toHaveBeenCalledWith(TICK, {
      periodInMinutes: 1,
    });
    expect(alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
    expect(typeof listener).toBe("function");
  });

  test("ignores alarms with a different name", async () => {
    const { setupAlarms } = await import("@/background/setup-alarms.js");
    const { handleUpdateResult } = await import("@/background/events.js");

    setupAlarms();

    await listener({ name: "OTHER_TICK" });

    expect(handleUpdateResult).not.toHaveBeenCalled();
  });

  test("handles the POMODORO_TICK flow in order", async () => {
    const { setupAlarms } = await import("@/background/setup-alarms.js");
    const { initTimer, getTimer, saveSnapshot, __fakeTimer } = await import(
      "@/background/timer-store.js"
    );
    const { handleUpdateResult } = await import("@/background/events.js");

    setupAlarms();

    await listener({ name: "POMODORO_TICK" });

    expect(initTimer).toHaveBeenCalled();
    expect(getTimer).toHaveBeenCalled();
    expect(__fakeTimer.update).toHaveBeenCalled();

    const res = __fakeTimer.update.mock.results[0].value;
    expect(handleUpdateResult).toHaveBeenCalledWith(__fakeTimer, res);

    expect(saveSnapshot).toHaveBeenCalled();
  });

  test("propagetes errors from handleUpdateResult and does not save snapshot afterwards", async () => {
    const { setupAlarms } = await import("@/background/setup-alarms.js");
    const { saveSnapshot } = await import("@/background/timer-store.js");
    const eventsMod = await import("@/background/events.js");
    eventsMod.handleUpdateResult.mockRejectedValueOnce(new Error("boom"));

    setupAlarms();
    
    await expect(listener({ name: TICK })).rejects.toThrow("boom");
    expect(saveSnapshot).not.toHaveBeenCalled();
  });

  test("calling setupAlarms multiple times", async () => {
    const { setupAlarms } = await import("@/background/setup-alarms.js");

    setupAlarms();
    setupAlarms();

    expect(alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
  });
});
