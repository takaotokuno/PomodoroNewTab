import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import * as timerStore from "@/background/timer-store.js";
import * as notification from "@/background/notification.js";
import Constants from "@/constants.js";
const { TIMER_MODES, SESSION_TYPES } = Constants;
import { routes } from "@/background/events.js";

vi.mock("@/background/setup-alarms.js", () => ({
  startTick: vi.fn().mockResolvedValue(undefined),
  stopTick: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/background/sites-guard.js", () => {
  return {
    enableBlock: vi.fn(),
    disableBlock: vi.fn(),
  };
});

const MOCK_TOTAL_REMAINING = 123;
const MOCK_SESSION_REMAINING = 45;
const MOCK_TIME = 1609459200000; // 2021-01-01T00:00:00Z

function initializeTimerStateMock() {
  return {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
    update: vi.fn(),
    mode: "start",
    getTotalRemaining: vi.fn().mockReturnValue(MOCK_TOTAL_REMAINING),
    sessionType: "work",
    getSessionRemaining: vi.fn().mockReturnValue(MOCK_SESSION_REMAINING),
  };
}

let fakeTimer;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_TIME);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  fakeTimer = initializeTimerStateMock();
  vi.spyOn(timerStore, "getTimer").mockReturnValue(fakeTimer);
  vi.spyOn(notification, "notify").mockResolvedValue();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("routes", () => {
  test('"timer/start" calls start wtesth minutes', () => {
    routes["timer/start"]({ minutes: 25 });
    expect(fakeTimer.start).toHaveBeenCalledWith(25);
  });

  test('"timer/pause" calls pause', () => {
    routes["timer/pause"]();
    expect(fakeTimer.pause).toHaveBeenCalled();
  });

  test('"timer/resume" calls resume', () => {
    routes["timer/resume"]();
    expect(fakeTimer.resume).toHaveBeenCalled();
  });

  test('"timer/reset" calls reset', () => {
    routes["timer/reset"]();
    expect(fakeTimer.reset).toHaveBeenCalled();
  });

  test('"timer/update" calls update and returns timer state', async () => {
    fakeTimer.update.mockReturnValue({});
    const result = await routes["timer/update"]();
    expect(fakeTimer.update).toHaveBeenCalled();
    expect(result).toEqual({
      mode: "start",
      totalRemaining: MOCK_TOTAL_REMAINING,
      sessionType: "work",
      sessionRemaining: MOCK_SESSION_REMAINING,
    });
  });

  test('"timer/update" notifies "complete" if isTotalComplete', async () => {
    fakeTimer.update.mockReturnValue({ mode: TIMER_MODES.COMPLETED });
    await routes["timer/update"]();

    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "complete" + MOCK_TIME, title: "ポモドーロ完了" })
    );
  });

  test('"timer/update" notifies "switch" if isSessionComplete (WORK)', async () => {
    fakeTimer.update.mockReturnValue({ sessionType: SESSION_TYPES.WORK, isSessionComplete: true });
    fakeTimer.currentSessionType = SESSION_TYPES.WORK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch" + MOCK_TIME, title: "作業開始！" })
    );
  });

  test('"timer/update" notifies "switch" if isSessionComplete (BREAK)', async () => {
    fakeTimer.update.mockReturnValue({ isSessionComplete: true });
    fakeTimer.currentSessionType = SESSION_TYPES.BREAK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch" + MOCK_TIME, title: "休憩開始" })
    );
  });
});
