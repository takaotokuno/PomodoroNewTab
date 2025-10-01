import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import * as timerStore from "@/background/timer-store.js";
import * as notification from "@/background/notification.js";
import Constants from "@/constants.js";
import { routes } from "@/background/events.js";

const MOCK_TOTAL_REMAINING = 123;
const MOCK_SESSION_REMAINING = 45;
function initializeTimerStateMock() {
  return {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
    update: vi.fn(),
    isActive: true,
    isPaused: false,
    getTotalRemaining: vi.fn().mockReturnValue(MOCK_TOTAL_REMAINING),
    currentSessionType: "WORK",
    getCurrentSessionRemaining: vi.fn().mockReturnValue(MOCK_SESSION_REMAINING),
  };
}

describe("routes", () => {
  let mock;

  beforeEach(() => {
    mock = initializeTimerStateMock();
    vi.spyOn(timerStore, "getTimer").mockReturnValue({ instance: mock });
    vi.spyOn(notification, "notify").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('"timer/start" calls start wtesth minutes', () => {
    routes["timer/start"]({ minutes: 25 });
    expect(mock.start).toHaveBeenCalledWith(25);
  });

  test('"timer/pause" calls pause', () => {
    routes["timer/pause"]();
    expect(mock.pause).toHaveBeenCalled();
  });

  test('"timer/resume" calls resume', () => {
    routes["timer/resume"]();
    expect(mock.resume).toHaveBeenCalled();
  });

  test('"timer/reset" calls reset', () => {
    routes["timer/reset"]();
    expect(mock.reset).toHaveBeenCalled();
  });

  test('"timer/update" calls update and returns timer state', async () => {
    mock.update.mockReturnValue({});
    const result = await routes["timer/update"]();
    expect(mock.update).toHaveBeenCalled();
    expect(result).toEqual({
      isActive: mock.isActive,
      isPaused: mock.isPaused,
      totalRemaining: MOCK_TOTAL_REMAINING,
      currentSessionType: "WORK",
      currentSessionRemaining: MOCK_SESSION_REMAINING,
    });
  });

  test('"timer/update" notifies "complete" if isTotalComplete', async () => {
    mock.update.mockReturnValue({ isTotalComplete: true });
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "complete" })
    );
  });

  test('"timer/update" notifies "switch" if isSessionComplete (WORK)', async () => {
    mock.update.mockReturnValue({ isSessionComplete: true });
    mock.currentSessionType = Constants.SESSION_TYPES.WORK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch", title: "作業開始！" })
    );
  });

  test('"timer/update" notifies "switch" if isSessionComplete (BREAK)', async () => {
    mock.update.mockReturnValue({ isSessionComplete: true });
    mock.currentSessionType = Constants.SESSION_TYPES.BREAK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch", title: "休憩開始" })
    );
  });
});
