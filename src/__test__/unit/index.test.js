import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { setupChromeMock } from "../setup.chrome";

const initTimerMock = vi.fn();
const saveSnapshotMock = vi.fn();
vi.mock("@/background/timer-store.js", () => ({
  initTimer: initTimerMock,
  saveSnapshot: saveSnapshotMock,
}));

vi.mock("@/background/setup-alarms.js", () => ({
  setupAlarms: vi.fn(),
}));

const routesMock = {
  "timer/start": vi.fn().mockImplementation(async () => ({ foo: "bar" })),
};
vi.mock("@/background/events.js", () => ({
  routes: routesMock,
}));

let resolveDone;
const judgeDone = () => new Promise((r) => (resolveDone = r));
const sendResponse = vi.fn((payload) => resolveDone(payload));

let runtime;
let listener;

beforeEach(() => {
  vi.resetModules();
  ({ runtime } = setupChromeMock());
  runtime.onMessage.addListener.mockImplementation((fn) => {
    listener = fn;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("background/index.js", () => {
  test("registers onInstalled and onStartup listeners", async () => {
    await import("@/background/index.js");
    expect(runtime.onInstalled.addListener).toHaveBeenCalledWith(initTimerMock);
    expect(runtime.onStartup.addListener).toHaveBeenCalledWith(initTimerMock);
  });

  test("routes messages to correct handler and responds", async () => {
    await import("@/background/index.js");

    const done = judgeDone();
    await listener({ type: "timer/start" }, null, sendResponse);
    const payload = await done;

    expect(initTimerMock).toHaveBeenCalled();
    expect(routesMock["timer/start"]).toHaveBeenCalledWith({
      type: "timer/start",
    });
    expect(saveSnapshotMock).toHaveBeenCalled();
    expect(payload).toEqual({ success: true, foo: "bar" });
  });

  test("responds with error for unknown route", async () => {
    await import("@/background/index.js");

    const done = judgeDone();
    await listener({ type: "unknown/type" }, null, sendResponse);
    const payload = await done;

    expect(payload).toEqual({
      ok: false,
      error: "unknown route",
    });
  });

  test("responds with error if handler throws", async () => {
    await import("@/background/index.js");

    const errMsg = "sample error message";
    routesMock["timer/start"].mockImplementation(() => {
      throw new Error(errMsg);
    });

    const done = judgeDone();
    await listener({ type: "timer/start" }, null, sendResponse);
    const payload = await done;

    expect(payload).toEqual({
      success: false,
      error: errMsg,
    });
  });
});
