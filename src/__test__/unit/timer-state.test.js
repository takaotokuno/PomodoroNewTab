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
const { TIMER_MODES, SESSION_TYPES, DURATIONS } = Constants;

describe("TimerState", () => {
  const mockStartTime = new Date("2021-01-01T00:00:00Z").getTime();
  const fiveMinutes = 5 * 60 * 1000;
  const elapsedTime = mockStartTime + fiveMinutes;
  const defaultTotal = Constants.DURATIONS.DEFAULT_TOTAL_MINUTES * 60 * 1000;

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
      expect(timer.mode).toBe(Constants.TIMER_MODES.SETUP);
      expect(timer.totalStartTime).toBe(null);
      expect(timer.totalDuration).toBe(null);
      expect(timer.totalElapsed).toBe(0);
      expect(timer.sessionType).toBe(Constants.SESSION_TYPES.WORK);
      expect(timer.sessionStartTime).toBe(null);
      expect(timer.sessionDuration).toBe(DURATIONS.WORK_SESSION);
      expect(timer.sessionElapsed).toBe(0);
      expect(timer.pausedAt).toBe(null);
      expect(timer.soundEnabled).toBe(false);
    });
  });

  describe("start()", () => {
    test("should start the timer with default duration", () => {
      timer.start();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
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

      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.pausedAt).toBe(elapsedTime);
      expect(timer.totalElapsed).toBe(fiveMinutes);
      expect(timer.sessionElapsed).toBe(fiveMinutes);
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

      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.pausedAt).toBe(null);
      expect(timer.totalStartTime).toBe(elapsedTime);
      expect(timer.sessionStartTime).toBe(elapsedTime);
    });
  });

  describe("pause() edge cases", () => {
    test("should not pause if timer is not running", () => {
      timer.pause(); // Timer is in SETUP mode
      expect(timer.mode).toBe(TIMER_MODES.SETUP);
      expect(timer.pausedAt).toBe(null);
    });

    test("should not pause if timer is already completed", () => {
      timer.start();
      timer.mode = TIMER_MODES.COMPLETED;
      timer.pause();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);
      expect(timer.pausedAt).toBe(null);
    });
  });

  describe("resume() edge cases", () => {
    test("should not resume if timer is not paused", () => {
      timer.start();
      const originalStartTime = timer.totalStartTime;
      timer.resume(); // Timer is RUNNING, not PAUSED
      expect(timer.totalStartTime).toBe(originalStartTime);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
    });

    test("should not resume if timer is in setup mode", () => {
      timer.resume(); // Timer is in SETUP mode
      expect(timer.mode).toBe(TIMER_MODES.SETUP);
    });
  });

  describe("reset()", () => {
    test("should reset timer to initial state", () => {
      timer.start();

      vi.setSystemTime(elapsedTime);
      timer.pause();

      timer.reset();

      expect(timer.mode).toBe(TIMER_MODES.SETUP);
      expect(timer.totalStartTime).toBe(null);
      expect(timer.totalDuration).toBe(null);
      expect(timer.totalElapsed).toBe(0);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(timer.sessionStartTime).toBe(null);
      expect(timer.sessionDuration).toBe(DURATIONS.WORK_SESSION);
      expect(timer.sessionElapsed).toBe(0);
      expect(timer.pausedAt).toBe(null);
    });

    test("should not reset sound settings when timer is reset", () => {
      timer.soundEnabled = true;
      timer.reset();
      expect(timer.soundEnabled).toBe(true);
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

      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);
    });

    test("should return session complete indicator when session switches", () => {
      const workCompleteTime = mockStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      const result = timer.update();

      expect(result.isSessionComplete).toBe(true);
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);
    });

    test("should switch session when session is complete", () => {
      const workCompleteTime = mockStartTime + DURATIONS.WORK_SESSION;
      const breakCompleteTime = workCompleteTime + DURATIONS.BREAK_SESSION;

      // switch to break session
      vi.setSystemTime(workCompleteTime);
      timer.update();

      expect(timer.sessionType).toBe(Constants.SESSION_TYPES.BREAK);
      expect(timer.sessionStartTime).toBe(workCompleteTime);
      expect(timer.sessionDuration).toBe(DURATIONS.BREAK_SESSION);
      expect(timer.sessionElapsed).toBe(0);

      // switch to working session
      vi.setSystemTime(breakCompleteTime);
      timer.update();

      expect(timer.sessionType).toBe(Constants.SESSION_TYPES.WORK);
      expect(timer.sessionStartTime).toBe(breakCompleteTime);
      expect(timer.sessionDuration).toBe(DURATIONS.WORK_SESSION);
      expect(timer.sessionElapsed).toBe(0);
    });

    test("should limit session duration to remaining total time", () => {
      // Start with short total time
      const shortTime = DURATIONS.WORK_SESSION / (60 * 1000) + 1;
      timer.start(shortTime); // 28 minutes total (< DURATIONS.WORK_SESSION)
      const shortBreakTime = mockStartTime + DURATIONS.WORK_SESSION;

      vi.setSystemTime(shortBreakTime);
      timer.update(); // Switch to break

      expect(timer.sessionDuration).toBe(1 * 60 * 1000);
    });

    test("should update elapsed time during active session", () => {
      vi.setSystemTime(elapsedTime);
      timer.update();

      expect(timer.totalElapsed).toBe(fiveMinutes);
      expect(timer.sessionElapsed).toBe(fiveMinutes);
    });
  });

  describe("getTotalRemaining()", () => {
    test("should return full duration when timer just started", () => {
      timer.start();
      expect(timer.getTotalRemaining()).toBe(defaultTotal);
    });

    test("should return 0 when timer is completed", () => {
      timer.start();
      vi.setSystemTime(mockStartTime + defaultTotal + 1000);
      timer.update();
      expect(timer.getTotalRemaining()).toBe(0);
    });

    test("should return correct remaining time", () => {
      timer.start();
      vi.setSystemTime(elapsedTime);
      timer.update();
      expect(timer.getTotalRemaining()).toBe(defaultTotal - fiveMinutes);
    });
  });

  describe("getSessionRemaining()", () => {
    test("should return full session duration when session just started", () => {
      timer.start();
      expect(timer.getSessionRemaining()).toBe(DURATIONS.WORK_SESSION);
    });

    test("should return next settion duration when session is completed", () => {
      timer.start();
      vi.setSystemTime(mockStartTime + DURATIONS.WORK_SESSION);
      timer.update();
      expect(timer.getSessionRemaining()).toBe(DURATIONS.BREAK_SESSION);
    });

    test("should return correct remaining session time", () => {
      timer.start();
      vi.setSystemTime(elapsedTime);
      timer.update();
      expect(timer.getSessionRemaining()).toBe(
        DURATIONS.WORK_SESSION - fiveMinutes
      );
    });
  });

  describe("toSnapshot()", () => {
    test("should create snapshot with all necessary fields", () => {
      timer.start(30);
      vi.setSystemTime(elapsedTime);
      timer.pause();

      const snapshot = timer.toSnapshot();

      expect(snapshot).toEqual({
        mode: TIMER_MODES.PAUSED,
        totalStartTime: mockStartTime,
        totalDuration: 30 * 60 * 1000,
        sessionType: SESSION_TYPES.WORK,
        sessionStartTime: mockStartTime,
        sessionDuration: DURATIONS.WORK_SESSION,
        pausedAt: elapsedTime,
        soundEnabled: false,
      });
    });

    test("should not include elapsed fields in snapshot", () => {
      timer.start();
      vi.setSystemTime(elapsedTime);
      timer.update();

      const snapshot = timer.toSnapshot();

      expect(snapshot).not.toHaveProperty("totalElapsed");
      expect(snapshot).not.toHaveProperty("sessionElapsed");
    });
  });

  describe("fromSnapshot()", () => {
    test("should restore timer from valid snapshot", () => {
      const snapshot = {
        mode: TIMER_MODES.RUNNING,
        totalStartTime: mockStartTime,
        totalDuration: 25 * 60 * 1000,
        sessionType: SESSION_TYPES.BREAK,
        sessionStartTime: mockStartTime + DURATIONS.WORK_SESSION,
        sessionDuration: DURATIONS.BREAK_SESSION,
        pausedAt: null,
        soundEnabled: true,
      };

      vi.setSystemTime(mockStartTime + DURATIONS.WORK_SESSION + fiveMinutes);
      const restoredTimer = TimerState.fromSnapshot(snapshot);

      expect(restoredTimer.mode).toBe(TIMER_MODES.RUNNING);
      expect(restoredTimer.sessionType).toBe(SESSION_TYPES.BREAK);
      expect(restoredTimer.totalDuration).toBe(25 * 60 * 1000);
      expect(restoredTimer.sessionDuration).toBe(DURATIONS.BREAK_SESSION);
      expect(restoredTimer.soundEnabled).toBe(true);
    });

    test("should return default timer for null snapshot", () => {
      const restoredTimer = TimerState.fromSnapshot(null);

      expect(restoredTimer.mode).toBe(TIMER_MODES.SETUP);
      expect(restoredTimer.totalStartTime).toBe(null);
      expect(restoredTimer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(restoredTimer.soundEnabled).toBe(false);
    });

    test("should return default timer for undefined snapshot", () => {
      const restoredTimer = TimerState.fromSnapshot(undefined);

      expect(restoredTimer.mode).toBe(TIMER_MODES.SETUP);
      expect(restoredTimer.totalStartTime).toBe(null);
    });

    test("should handle partial snapshot with defaults", () => {
      const partialSnapshot = {
        mode: TIMER_MODES.RUNNING,
        totalStartTime: mockStartTime,
      };

      const restoredTimer = TimerState.fromSnapshot(partialSnapshot);

      expect(restoredTimer.mode).toBe(TIMER_MODES.RUNNING);
      expect(restoredTimer.totalStartTime).toBe(mockStartTime);
      expect(restoredTimer.totalDuration).toBe(
        DURATIONS.DEFAULT_TOTAL_MINUTES * 60 * 1000
      );
      expect(restoredTimer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(restoredTimer.sessionDuration).toBe(DURATIONS.WORK_SESSION);
    });

    test("should handle snapshot with falsy mode value", () => {
      const snapshotWithFalsyMode = {
        mode: 0, // falsy but not null/undefined
        totalStartTime: mockStartTime,
      };

      const restoredTimer = TimerState.fromSnapshot(snapshotWithFalsyMode);

      expect(restoredTimer.mode).toBe(TIMER_MODES.SETUP); // Should default to SETUP
      expect(restoredTimer.totalStartTime).toBe(mockStartTime);
    });

    test("should recompute elapsed times based on current time", () => {
      const snapshot = {
        mode: TIMER_MODES.RUNNING,
        totalStartTime: mockStartTime,
        totalDuration: 60 * 60 * 1000,
        sessionType: SESSION_TYPES.WORK,
        sessionStartTime: mockStartTime,
        sessionDuration: DURATIONS.WORK_SESSION,
        pausedAt: null,
      };

      vi.setSystemTime(elapsedTime);
      const restoredTimer = TimerState.fromSnapshot(snapshot);

      expect(restoredTimer.totalElapsed).toBe(fiveMinutes);
      expect(restoredTimer.sessionElapsed).toBe(fiveMinutes);
    });
  });
});
