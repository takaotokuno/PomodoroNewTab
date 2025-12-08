/**
 * Unit tests for background/index.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";

// Mock timer-store functions
const initTimerMock = vi.fn();
const saveSnapshotMock = vi.fn();
vi.mock("@/background/timer-store.js", () => ({
  initTimer: initTimerMock,
  saveSnapshot: saveSnapshotMock,
}));

// Mock setup-alarms
const setupAlarmsMock = vi.fn();
vi.mock("@/background/setup-alarms.js", () => ({
  setupAlarms: setupAlarmsMock,
}));

// Mock sound-controller
const setupSoundMock = vi.fn();
vi.mock("@/background/sound-controller.js", () => ({
  setupSound: setupSoundMock,
}));

// Mock events handleEvents
const handleEventsMock = vi
  .fn()
  .mockImplementation(async () => ({ foo: "bar" }));
vi.mock("@/background/events.js", () => ({
  handleEvents: handleEventsMock,
}));

describe("BackgroundIndex", () => {
  let resolveDone;
  const judgeDone = () => new Promise((r) => (resolveDone = r));
  const sendResponse = vi.fn((payload) => resolveDone(payload));

  let runtime;
  let listener;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    ({ runtime } = setupChromeMock());
    runtime.onMessage.addListener.mockImplementation((fn) => {
      listener = fn;
    });
  });
  describe("Event Listeners Registration", () => {
    test("should register onInstalled and onStartup listeners", async () => {
      await import("@/background/index.js");

      expect(runtime.onInstalled.addListener).toHaveBeenCalledWith(
        initTimerMock
      );
      expect(runtime.onStartup.addListener).toHaveBeenCalledWith(initTimerMock);
    });

    test("should call setupAlarms on module load", async () => {
      await import("@/background/index.js");

      expect(setupAlarmsMock).toHaveBeenCalled();
    });

    test("should register onMessage listener", async () => {
      await import("@/background/index.js");

      expect(runtime.onMessage.addListener).toHaveBeenCalled();
      expect(typeof listener).toBe("function");
    });
  });

  describe("Message Routing", () => {
    test("should route messages to correct handler and respond with success", async () => {
      await import("@/background/index.js");

      const done = judgeDone();
      await listener({ type: "timer/start" }, null, sendResponse);
      const payload = await done;

      expect(handleEventsMock).toHaveBeenCalledWith("timer/start", {
        type: "timer/start",
      });
      expect(payload).toEqual({ foo: "bar" });
    });

    test("should respond with error for unknown route", async () => {
      await import("@/background/index.js");

      handleEventsMock.mockImplementation(() => {
        throw new Error("Unknown event type: unknown/type");
      });

      const done = judgeDone();
      await listener({ type: "unknown/type" }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "Unknown event type: unknown/type",
      });
    });

    test("should respond with error if handler throws exception", async () => {
      await import("@/background/index.js");

      const errMsg = "sample error message";
      handleEventsMock.mockImplementation(() => {
        throw new Error(errMsg);
      });

      const done = judgeDone();
      await listener({ type: "timer/start" }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: errMsg,
      });
    });

    test("should respond with error when message is null", async () => {
      await import("@/background/index.js");

      const done = judgeDone();
      await listener(null, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "Cannot read properties of null (reading 'type')",
      });
    });

    test("should respond with error when message is undefined", async () => {
      await import("@/background/index.js");

      const done = judgeDone();
      await listener(undefined, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "Cannot read properties of undefined (reading 'type')",
      });
    });

    test("should respond with error when message type is null", async () => {
      await import("@/background/index.js");

      handleEventsMock.mockImplementation(() => {
        throw new Error("Unknown event type: null");
      });

      const done = judgeDone();
      await listener({ type: null }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "Unknown event type: null",
      });
    });

    test("should respond with error when message type is undefined", async () => {
      await import("@/background/index.js");

      handleEventsMock.mockImplementation(() => {
        throw new Error("Unknown event type: undefined");
      });

      const done = judgeDone();
      await listener({ type: undefined }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "Unknown event type: undefined",
      });
    });

    test("should handle error object without message property", async () => {
      await import("@/background/index.js");

      const errorObj = { code: 500 };
      handleEventsMock.mockImplementation(() => {
        throw errorObj;
      });

      const done = judgeDone();
      await listener({ type: "timer/start" }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: "[object Object]",
      });
    });

    test("should handle string error", async () => {
      await import("@/background/index.js");

      const errorString = "string error";
      handleEventsMock.mockImplementation(() => {
        throw errorString;
      });

      const done = judgeDone();
      await listener({ type: "timer/start" }, null, sendResponse);
      const payload = await done;

      expect(payload).toEqual({
        success: false,
        severity: "fatal",
        error: errorString,
      });
    });

    test("should return true to indicate async response", async () => {
      await import("@/background/index.js");

      const result = listener({ type: "timer/start" }, null, sendResponse);

      expect(result).toBe(true);
    });
  });

  describe("Module Loading", () => {
    test("should only initialize once when imported multiple times in same context", async () => {
      // ES modules only execute once even when imported multiple times in the same context
      await import("@/background/index.js");
      await import("@/background/index.js");

      // Initialization should only happen once
      expect(runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
      expect(runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
      expect(setupAlarmsMock).toHaveBeenCalledTimes(1);
    });

    test("should initialize again after module reset", async () => {
      // First import
      await import("@/background/index.js");

      expect(runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
      expect(setupAlarmsMock).toHaveBeenCalledTimes(1);

      // Reset modules and re-import
      vi.resetModules();
      vi.clearAllMocks();

      // Setup new Chrome mock
      ({ runtime } = setupChromeMock());
      runtime.onMessage.addListener.mockImplementation((fn) => {
        listener = fn;
      });

      await import("@/background/index.js");

      // Should initialize again after reset
      expect(runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
      expect(setupAlarmsMock).toHaveBeenCalledTimes(1);
    });
  });
});
