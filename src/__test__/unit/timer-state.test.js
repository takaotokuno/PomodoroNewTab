/**
 * Unit tests for timer-state.js
 */
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import TimerState from "@/timer-state.js";
import Constants from "@/constants.js";

describe("TimerState", () => {
  const mockStartTime = new Date("2021-01-01T00:00:00Z").getTime();
  const fiveMinutes = 5 * 60 * 1000;
  const elapsedTime = mockStartTime + fiveMinutes;
  const defaultTotal = Constants.DURATIONS.DEFAULT_TOTAL_MINUTES * 60 * 1000;
  const workSession = Constants.DURATIONS.WORK_SESSION;
  const breakSession = Constants.DURATIONS.BREAK_SESSION;

  let timer;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(mockStartTime);
    timer = new TimerState();
  });

  describe("Constructor", () => {
    test("should initialize with default values", () => {
      expect(timer.isActive).toBe(false);
      expect(timer.isPaused).toBe(false);
      expect(timer.totalStartTime).toBe(null);
      expect(timer.totalDuration).toBe(null);
      expect(timer.totalElapsed).toBe(0);
      expect(timer.currentSessionType).toBe(Constants.SESSION_TYPES.WORK);
      expect(timer.currentSessionStartTime).toBe(null);
      expect(timer.currentSessionDuration).toBe(
        Constants.DURATIONS.WORK_SESSION
      );
      expect(timer.currentSessionElapsed).toBe(0);
      expect(timer.pausedAt).toBe(null);
    });
  });

  describe("start()", () => {
    test("should start the timer with default duration", () => {
      timer.start();
      expect(timer.isActive).toBe(true);
      expect(timer.totalStartTime).toBe(mockStartTime);
      expect(timer.totalDuration).toBe(defaultTotal);
    });

    test("should start the timer with specified duration", () => {
      const mockDuration = 90;
      timer.start(mockDuration);
      expect(timer.totalDuration).toBe(mockDuration * 60 * 1000);
    });
  });

  describe("pause() and resume()", () => {
    beforeEach(() => {
      timer.start();
      vi.setSystemTime(elapsedTime);
    });

    afterEach(() => {
      vi.setSystemTime(mockStartTime);
    });

    test("should pause active timer", () => {
      timer.pause();

      expect(timer.isPaused).toBe(true);
      expect(timer.pausedAt).toBe(elapsedTime);
      expect(timer.totalElapsed).toBe(fiveMinutes);
      expect(timer.currentSessionElapsed).toBe(fiveMinutes);
    });

    test("should not update pausedAt if already paused", () => {
      timer.pause();

      vi.setSystemTime(elapsedTime + fiveMinutes);
      timer.pause();

      expect(timer.pausedAt).toBe(elapsedTime);
    });

    test("should resume from paused state", () => {
      timer.pause();

      vi.setSystemTime(elapsedTime + fiveMinutes);
      timer.resume();

      expect(timer.isPaused).toBe(false);
      expect(timer.pausedAt).toBe(null);
      expect(timer.totalStartTime).toBe(elapsedTime);
      expect(timer.currentSessionStartTime).toBe(elapsedTime);
    });
  });

  describe("reset()", () => {
    test("should reset timer to initial state", () => {
      timer.start();

      vi.setSystemTime(elapsedTime);
      timer.pause();

      timer.reset();

      expect(timer.isActive).toBe(false);
      expect(timer.isPaused).toBe(false);
      expect(timer.totalStartTime).toBe(null);
      expect(timer.totalDuration).toBe(null);
      expect(timer.totalElapsed).toBe(0);
      expect(timer.currentSessionType).toBe(Constants.SESSION_TYPES.WORK);
      expect(timer.currentSessionStartTime).toBe(null);
      expect(timer.currentSessionDuration).toBe(
        Constants.DURATIONS.WORK_SESSION
      );
      expect(timer.currentSessionElapsed).toBe(0);
      expect(timer.pausedAt).toBe(null);
    });
  });

  describe("update()", () => {
    beforeEach(() => {
      timer.start();
    });

    test("should not update if timer is inactive", () => {
      timer.reset();

      vi.setSystemTime(elapsedTime);
      timer.update();

      expect(timer.totalElapsed).toBe(0);
    });

    test("should not update if timer is paused", () => {
      timer.pause();

      vi.setSystemTime(elapsedTime);
      timer.update();

      expect(timer.totalElapsed).toBe(0);
    });

    test("should complete timer when total time is reached", () => {
      const defaultCompleteTime = mockStartTime + defaultTotal;
      vi.setSystemTime(defaultCompleteTime);
      timer.update();

      expect(timer.isActive).toBe(false);
    });

    test("should switch session when session is complete", () => {
      const workCompleteTime = mockStartTime + workSession;
      const breakCompleteTime = workCompleteTime + breakSession;

      // switch to break session
      vi.setSystemTime(workCompleteTime);
      timer.update();

      expect(timer.currentSessionType).toBe(Constants.SESSION_TYPES.BREAK);
      expect(timer.currentSessionStartTime).toBe(workCompleteTime);
      expect(timer.currentSessionDuration).toBe(breakSession);
      expect(timer.currentSessionElapsed).toBe(0);

      // switch to working session
      vi.setSystemTime(breakCompleteTime);
      timer.update();

      expect(timer.currentSessionType).toBe(Constants.SESSION_TYPES.WORK);
      expect(timer.currentSessionStartTime).toBe(breakCompleteTime);
      expect(timer.currentSessionDuration).toBe(workSession);
      expect(timer.currentSessionElapsed).toBe(0);
    });

    test("should update elapsed time during active session", () => {
      vi.setSystemTime(elapsedTime);
      timer.update();

      expect(timer.totalElapsed).toBe(fiveMinutes);
      expect(timer.currentSessionElapsed).toBe(fiveMinutes);
    });

    test("can get total remaining time", () => {
      vi.setSystemTime(elapsedTime);
      timer.update();

      const remainingTime = timer.getTotalRemaining();
      expect(remainingTime).toBe(defaultTotal - fiveMinutes);
    });

    test("getSessionRemaining", () => {
      vi.setSystemTime(elapsedTime);
      timer.update();

      const remainingTime = timer.getCurrentSessionRemaining();
      expect(remainingTime).toBe(workSession - fiveMinutes);
    });
  });
});
