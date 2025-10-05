/**
 * Unit tests for timer-ticker.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { TimerTicker } from "@/ui/timer-ticker.js";
import Constants from "@/constants.js";

const { DURATIONS, SESSION_TYPES } = Constants;

describe("TimerTicker", () => {
  let timerTicker;
  let mockUIController;
  let mockElements;

  beforeEach(() => {
    // Mock DOM elements
    mockElements = {
      timeTotalView: { textContent: "" },
      timeSessionLabel: { textContent: "" },
      timeSessionView: { textContent: "" },
    };

    vi.stubGlobal("document", {
      getElementById: vi.fn((id) => {
        switch (id) {
          case "time-total":
            return mockElements.timeTotalView;
          case "time-session-label":
            return mockElements.timeSessionLabel;
          case "time-session":
            return mockElements.timeSessionView;
          default:
            return null;
        }
      }),
    });

    // Mock UI controller
    mockUIController = {
      syncFromBG: vi.fn().mockResolvedValue(undefined),
    };

    // Mock setInterval/clearInterval
    vi.useFakeTimers();

    timerTicker = new TimerTicker(mockUIController);
  });

  afterEach(() => {
    timerTicker.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    test("should initialize with correct default values", () => {
      expect(timerTicker.uiController).toBe(mockUIController);
      expect(timerTicker.interval).toBe(null);
      expect(timerTicker.sessionType).toBe(null);
      expect(timerTicker.timeTotalMs).toBe(0);
      expect(timerTicker.timeSessionMs).toBe(0);
    });

    test("should get DOM elements correctly", () => {
      expect(timerTicker.timeTotalView).toBe(mockElements.timeTotalView);
      expect(timerTicker.timeSessionLabel).toBe(mockElements.timeSessionLabel);
      expect(timerTicker.timeSessionView).toBe(mockElements.timeSessionView);
    });
  });

  describe("start()", () => {
    test("should start timer with valid minutes", () => {
      timerTicker.start(25);

      expect(timerTicker.timeTotalMs).toBe(25 * 60 * 1000);
      expect(timerTicker.timeSessionMs).toBe(DURATIONS.WORK_SESSION);
      expect(timerTicker.interval).not.toBe(null);
    });

    test("should limit session time to work session duration", () => {
      const shortMinutes = 10; // Less than work session duration
      timerTicker.start(shortMinutes);

      expect(timerTicker.timeTotalMs).toBe(shortMinutes * 60 * 1000);
      expect(timerTicker.timeSessionMs).toBe(shortMinutes * 60 * 1000);
    });

    test("should throw error for invalid minutes", () => {
      expect(() => timerTicker.start(0)).toThrow("Invalid minutes");
      expect(() => timerTicker.start(-5)).toThrow("Invalid minutes");
      expect(() => timerTicker.start(null)).toThrow("Invalid minutes");
      expect(() => timerTicker.start(undefined)).toThrow("Invalid minutes");
    });
  });

  describe("resume() and stop()", () => {
    test("should start interval on resume", () => {
      timerTicker.resume();
      expect(timerTicker.interval).not.toBe(null);
    });

    test("should clear existing interval before starting new one", () => {
      timerTicker.resume();
      const firstInterval = timerTicker.interval;

      timerTicker.resume();
      const secondInterval = timerTicker.interval;

      expect(firstInterval).not.toBe(secondInterval);
      expect(timerTicker.interval).not.toBe(null);
    });

    test("should clear interval on stop", () => {
      timerTicker.resume();
      expect(timerTicker.interval).not.toBe(null);

      timerTicker.stop();
      expect(timerTicker.interval).toBe(null);
    });

    test("should handle stop when no interval is running", () => {
      expect(() => timerTicker.stop()).not.toThrow();
      expect(timerTicker.interval).toBe(null);
    });
  });

  describe("applyBG()", () => {
    test("should apply work session state from background", () => {
      const totalMs = 25 * 60 * 1000;
      const sessionMs = 20 * 60 * 1000;

      timerTicker.applyBG(SESSION_TYPES.WORK, totalMs, sessionMs);

      expect(timerTicker.sessionType).toBe(SESSION_TYPES.WORK);
      expect(timerTicker.timeTotalMs).toBe(totalMs);
      expect(timerTicker.timeSessionMs).toBe(sessionMs);
      expect(mockElements.timeSessionLabel.textContent).toBe("Working");
    });

    test("should apply break session state from background", () => {
      const totalMs = 25 * 60 * 1000;
      const sessionMs = 5 * 60 * 1000;

      timerTicker.applyBG(SESSION_TYPES.BREAK, totalMs, sessionMs);

      expect(timerTicker.sessionType).toBe(SESSION_TYPES.BREAK);
      expect(timerTicker.timeTotalMs).toBe(totalMs);
      expect(timerTicker.timeSessionMs).toBe(sessionMs);
      expect(mockElements.timeSessionLabel.textContent).toBe("Break time");
    });
  });

  describe("tick()", () => {
    beforeEach(() => {
      timerTicker.timeTotalMs = 5000; // 5 seconds
      timerTicker.timeSessionMs = 3000; // 3 seconds
    });

    test("should decrement time by 1 second", async () => {
      await timerTicker.tick();

      expect(timerTicker.timeTotalMs).toBe(4000);
      expect(timerTicker.timeSessionMs).toBe(2000);
    });

    test("should call informTimeOut when total time reaches zero", async () => {
      timerTicker.timeTotalMs = 1000;
      timerTicker.timeSessionMs = 2000;

      await timerTicker.tick();

      expect(mockUIController.syncFromBG).toHaveBeenCalled();
      expect(timerTicker.timeTotalMs).toBe(0);
    });

    test("should call informTimeOut when session time reaches zero", async () => {
      timerTicker.timeTotalMs = 2000;
      timerTicker.timeSessionMs = 1000;

      await timerTicker.tick();

      expect(mockUIController.syncFromBG).toHaveBeenCalled();
      expect(timerTicker.timeSessionMs).toBe(0);
    });

    test("should not allow negative time values", async () => {
      timerTicker.timeTotalMs = 500;
      timerTicker.timeSessionMs = 500;

      await timerTicker.tick();

      expect(timerTicker.timeTotalMs).toBe(0);
      expect(timerTicker.timeSessionMs).toBe(0);
    });
  });

  describe("render()", () => {
    test("should render time correctly", () => {
      timerTicker.timeTotalMs = 125000; // 2:05
      timerTicker.timeSessionMs = 65000; // 1:05

      timerTicker.render();

      expect(mockElements.timeTotalView.textContent).toBe("02:05");
      expect(mockElements.timeSessionView.textContent).toBe("01:05");
    });

    test("should pad single digits with zero", () => {
      timerTicker.timeTotalMs = 65000; // 1:05
      timerTicker.timeSessionMs = 5000; // 0:05

      timerTicker.render();

      expect(mockElements.timeTotalView.textContent).toBe("01:05");
      expect(mockElements.timeSessionView.textContent).toBe("00:05");
    });
  });

  describe("renderElm()", () => {
    test("should format milliseconds to MM:SS correctly", () => {
      const testCases = [
        { ms: 0, expected: "00:00" },
        { ms: 1000, expected: "00:01" },
        { ms: 60000, expected: "01:00" },
        { ms: 125000, expected: "02:05" },
        { ms: 3661000, expected: "61:01" }, // Over 60 minutes
      ];

      testCases.forEach(({ ms, expected }) => {
        timerTicker.renderElm(ms, mockElements.timeTotalView);
        expect(mockElements.timeTotalView.textContent).toBe(expected);
      });
    });
  });

  describe("informTimeOut()", () => {
    test("should call uiController.syncFromBG", async () => {
      await timerTicker.informTimeOut();
      expect(mockUIController.syncFromBG).toHaveBeenCalledOnce();
    });

    test("should handle syncFromBG errors gracefully", async () => {
      mockUIController.syncFromBG.mockRejectedValue(new Error("Sync failed"));

      await expect(timerTicker.informTimeOut()).rejects.toThrow("Sync failed");
    });
  });

  describe("Integration with setInterval", () => {
    test("should call tick every second when running", async () => {
      const tickSpy = vi.spyOn(timerTicker, "tick").mockResolvedValue();

      timerTicker.start(1);

      // Advance time by 3 seconds
      await vi.advanceTimersByTimeAsync(3000);

      expect(tickSpy).toHaveBeenCalledTimes(3);

      tickSpy.mockRestore();
    });

    test("should stop calling tick after stop()", async () => {
      const tickSpy = vi.spyOn(timerTicker, "tick").mockResolvedValue();

      timerTicker.start(1);
      await vi.advanceTimersByTimeAsync(1000);

      timerTicker.stop();
      await vi.advanceTimersByTimeAsync(2000);

      expect(tickSpy).toHaveBeenCalledTimes(1);

      tickSpy.mockRestore();
    });
  });
});
