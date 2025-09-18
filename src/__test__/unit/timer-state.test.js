/**
 * Unit tests for timer-state.js
 */
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import TimerState from "@/timer-state.js";
import Constants from "@/constants.js";

describe("TimerState", () => {
  const mockStartTime = 1609459200000; // Jan 1, 2021 00:00:00 GMT

  let timer;
  let nowSpy;

  beforeAll(() => {
    nowSpy = vi.spyOn(Date, "now").mockImplementation(() => mockStartTime);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
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
      expect(timer.totalDuration).toBe(
        Constants.DURATIONS.DEFAULT_TOTAL_MINUTES * 60 * 1000
      );
    });
    test("should start the timer with specified duration", () => {
      const mockDuration = 90;
      timer.start(mockDuration);
      expect(timer.isActive).toBe(true);
      expect(timer.totalStartTime).toBe(mockStartTime);
      expect(timer.totalDuration).toBe(mockDuration * 60 * 1000);
    });
  });
});
