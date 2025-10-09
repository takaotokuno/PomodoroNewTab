/**
 * Unit tests for events.js
 */
import {
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import * as timerStore from "@/background/timer-store.js";
import * as notification from "@/background/notification.js";
import Constants from "@/constants.js";
import { handleEvents } from "@/background/events.js";

const { TIMER_MODES, SESSION_TYPES } = Constants;

// Mock dependencies
vi.mock("@/background/setup-alarms.js", () => ({
  startTick: vi.fn().mockResolvedValue(undefined),
  stopTick: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/background/sites-guard.js", () => ({
  enableBlock: vi.fn(),
  disableBlock: vi.fn(),
}));

vi.mock("@/background/timer-store.js", () => ({
  initTimer: vi.fn().mockResolvedValue(undefined),
  getTimer: vi.fn(),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/background/sound-controller.js", () => ({
  handleSound: vi.fn().mockResolvedValue(undefined),
}));

// Test constants
const MOCK_TOTAL_REMAINING = 123;
const MOCK_SESSION_REMAINING = 45;
const MOCK_TIME = 1609459200000; // 2021-01-01T00:00:00Z

// Mock timer instance factory
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
let mockStartTick, mockStopTick, mockEnableBlock, mockDisableBlock;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_TIME);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Get mock functions from the mocked modules
  const setupAlarms = await import("@/background/setup-alarms.js");
  const sitesGuard = await import("@/background/sites-guard.js");

  mockStartTick = setupAlarms.startTick;
  mockStopTick = setupAlarms.stopTick;
  mockEnableBlock = sitesGuard.enableBlock;
  mockDisableBlock = sitesGuard.disableBlock;

  fakeTimer = initializeTimerStateMock();
  vi.spyOn(timerStore, "getTimer").mockReturnValue(fakeTimer);
  vi.spyOn(notification, "notify").mockResolvedValue();
});

describe("Events", () => {
  describe("handleEvents", () => {
    test('should call start with minutes when "timer/start" is invoked', async () => {
      await handleEvents("timer/start", { minutes: 25 });

      expect(fakeTimer.start).toHaveBeenCalledWith(25);
    });

    test('should call pause when "timer/pause" is invoked', async () => {
      await handleEvents("timer/pause");

      expect(fakeTimer.pause).toHaveBeenCalled();
    });

    test('should call resume when "timer/resume" is invoked', async () => {
      await handleEvents("timer/resume");

      expect(fakeTimer.resume).toHaveBeenCalled();
    });

    test('should call reset when "timer/reset" is invoked', async () => {
      await handleEvents("timer/reset");

      expect(fakeTimer.reset).toHaveBeenCalled();
    });

    test('should call update and return timer state when "timer/update" is invoked', async () => {
      fakeTimer.update.mockReturnValue({});

      const result = await handleEvents("timer/update");

      expect(fakeTimer.update).toHaveBeenCalled();
      expect(result).toEqual({
        mode: "start",
        totalRemaining: MOCK_TOTAL_REMAINING,
        sessionType: "work",
        sessionRemaining: MOCK_SESSION_REMAINING,
        soundEnabled: undefined,
      });
    });

    test('should notify "complete" when timer is completed', async () => {
      fakeTimer.update.mockReturnValue({ mode: TIMER_MODES.COMPLETED });

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining("complete"),
          title: "ポモドーロ完了",
        })
      );
    });

    test('should notify "switch" when work session is complete', async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.WORK,
        isSessionComplete: true,
      });
      fakeTimer.currentSessionType = SESSION_TYPES.WORK;

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining("switch"),
          title: "作業開始！",
        })
      );
    });

    test('should notify "switch" when break session is complete', async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.BREAK,
        isSessionComplete: true,
      });
      fakeTimer.currentSessionType = SESSION_TYPES.BREAK;

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining("switch"),
          title: "休憩開始",
        })
      );
    });

    test('should throw error when "timer/start" is called with invalid minutes', async () => {
      await expect(
        handleEvents("timer/start", { minutes: -1 })
      ).rejects.toThrow("Invalid minutes");
    });

    test('should throw error when "timer/start" is called without minutes', async () => {
      await expect(handleEvents("timer/start", {})).rejects.toThrow(
        "Invalid minutes"
      );
    });

    test('should enable block and start tick when "timer/start" is invoked', async () => {
      await handleEvents("timer/start", { minutes: 25 });

      expect(mockEnableBlock).toHaveBeenCalled();
      expect(mockStartTick).toHaveBeenCalled();
    });

    test('should stop tick when "timer/pause" is invoked', async () => {
      await handleEvents("timer/pause");

      expect(mockStopTick).toHaveBeenCalled();
    });

    test('should start tick when "timer/resume" is invoked', async () => {
      await handleEvents("timer/resume");

      expect(mockStartTick).toHaveBeenCalled();
    });

    test('should disable block and stop tick when "timer/reset" is invoked', async () => {
      await handleEvents("timer/reset");

      expect(mockDisableBlock).toHaveBeenCalled();
      expect(mockStopTick).toHaveBeenCalled();
    });

    test("should disable block and stop tick when timer is completed", async () => {
      fakeTimer.update.mockReturnValue({ mode: TIMER_MODES.COMPLETED });

      await handleEvents("timer/update");

      expect(mockDisableBlock).toHaveBeenCalled();
      expect(mockStopTick).toHaveBeenCalled();
    });

    test("should enable block when work session is complete", async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.WORK,
        isSessionComplete: true,
      });

      await handleEvents("timer/update");

      expect(mockEnableBlock).toHaveBeenCalled();
    });

    test("should disable block when break session is complete", async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.BREAK,
        isSessionComplete: true,
      });

      await handleEvents("timer/update");

      expect(mockDisableBlock).toHaveBeenCalled();
    });

    test("should include complete notification message", async () => {
      fakeTimer.update.mockReturnValue({ mode: TIMER_MODES.COMPLETED });

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "お疲れ様！また頑張ろう",
        })
      );
    });

    test("should include work session notification message", async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.WORK,
        isSessionComplete: true,
      });

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "SNSをブロックしたよ。作業に集中しよう",
        })
      );
    });

    test("should include break session notification message", async () => {
      fakeTimer.update.mockReturnValue({
        sessionType: SESSION_TYPES.BREAK,
        isSessionComplete: true,
      });

      await handleEvents("timer/update");

      expect(notification.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ブロックを解除したよ。肩の力を抜こう",
        })
      );
    });

    test("should not call any handlers when update returns null", async () => {
      fakeTimer.update.mockReturnValue(null);

      await handleEvents("timer/update");

      expect(notification.notify).not.toHaveBeenCalled();
      expect(mockEnableBlock).not.toHaveBeenCalled();
      expect(mockDisableBlock).not.toHaveBeenCalled();
      expect(mockStopTick).not.toHaveBeenCalled();
    });

    test("should not call any handlers when update returns undefined", async () => {
      fakeTimer.update.mockReturnValue(undefined);

      await handleEvents("timer/update");

      expect(notification.notify).not.toHaveBeenCalled();
      expect(mockEnableBlock).not.toHaveBeenCalled();
      expect(mockDisableBlock).not.toHaveBeenCalled();
      expect(mockStopTick).not.toHaveBeenCalled();
    });
  });
});
