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

vi.mock("@/background/notification.js", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
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
let mockInitTimer, mockSaveSnapshot, mockHandleSound, mockNotify;

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
  const timerStoreModule = await import("@/background/timer-store.js");
  const soundController = await import("@/background/sound-controller.js");
  const notificationModule = await import("@/background/notification.js");

  mockStartTick = setupAlarms.startTick;
  mockStopTick = setupAlarms.stopTick;
  mockEnableBlock = sitesGuard.enableBlock;
  mockDisableBlock = sitesGuard.disableBlock;
  mockInitTimer = timerStoreModule.initTimer;
  mockSaveSnapshot = timerStoreModule.saveSnapshot;
  mockHandleSound = soundController.handleSound;
  mockNotify = notificationModule.notify;

  fakeTimer = initializeTimerStateMock();
  vi.spyOn(timerStore, "getTimer").mockReturnValue(fakeTimer);
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
        success: true,
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

    test('should return fatal error when "timer/start" is called with minutes below minimum', async () => {
      const result = await handleEvents("timer/start", { minutes: 4 });
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid minutes: must be at least 5");
    });

    test('should return fatal error when "timer/start" is called with minutes above maximum', async () => {
      const result = await handleEvents("timer/start", { minutes: 301 });
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid minutes: must be at most 300");
    });

    test('should return fatal error when "timer/start" is called without minutes', async () => {
      const result = await handleEvents("timer/start", {});
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid minutes: parameter is required");
    });

    test('should return fatal error when "timer/start" is called with non-number minutes', async () => {
      const result = await handleEvents("timer/start", { minutes: "25" });
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid minutes: must be a number");
    });

    test('should return fatal error when "timer/start" is called with NaN', async () => {
      const result = await handleEvents("timer/start", { minutes: NaN });
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid minutes: must be a number");
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

    test('should save sound settings when "sound/save" is invoked with true', async () => {
      const result = await handleEvents("sound/save", { isEnabled: true });

      expect(fakeTimer.soundEnabled).toBe(true);
      expect(result.soundEnabled).toBe(true);
    });

    test('should save sound settings when "sound/save" is invoked with false', async () => {
      const result = await handleEvents("sound/save", { isEnabled: false });

      expect(fakeTimer.soundEnabled).toBe(false);
      expect(result.soundEnabled).toBe(false);
    });

    test('should convert truthy values to boolean in "sound/save"', async () => {
      const result = await handleEvents("sound/save", { isEnabled: "yes" });

      expect(fakeTimer.soundEnabled).toBe(true);
      expect(result.soundEnabled).toBe(true);
    });

    test('should convert falsy values to boolean in "sound/save"', async () => {
      const result = await handleEvents("sound/save", { isEnabled: 0 });

      expect(fakeTimer.soundEnabled).toBe(false);
      expect(result.soundEnabled).toBe(false);
    });

    test('should return fatal error when "sound/save" is called without isEnabled', async () => {
      const result = await handleEvents("sound/save", {});
      
      expect(result.success).toBe(false);
      expect(result.severity).toBe(Constants.SEVERITY_LEVELS.FATAL);
      expect(result.error).toContain("Invalid isEnabled: parameter is required");
    });
  });

  describe("Error handling and conversion", () => {
    test("should return fatal error when initTimer throws", async () => {
      mockInitTimer.mockRejectedValueOnce(new Error("Init failed"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Init failed",
      });
    });

    test("should return fatal error when enableBlock throws in timer/start", async () => {
      mockEnableBlock.mockRejectedValueOnce(new Error("Block failed"));

      const result = await handleEvents("timer/start", { minutes: 25 });

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Block failed",
      });
    });

    test("should return fatal error when startTick throws in timer/start", async () => {
      mockStartTick.mockRejectedValueOnce(new Error("Tick failed"));

      const result = await handleEvents("timer/start", { minutes: 25 });

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Tick failed",
      });
    });

    test("should return fatal error when stopTick throws in timer/pause", async () => {
      mockStopTick.mockRejectedValueOnce(new Error("Stop failed"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Stop failed",
      });
    });

    test("should return fatal error when disableBlock throws in timer/reset", async () => {
      mockDisableBlock.mockRejectedValueOnce(new Error("Disable failed"));

      const result = await handleEvents("timer/reset");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Disable failed",
      });
    });

    test("should return warning when handleSound throws", async () => {
      mockHandleSound.mockRejectedValueOnce(new Error("Sound failed"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.WARNING,
        error: "Sound failed",
      });
    });

    test("should return warning when saveSnapshot throws", async () => {
      mockSaveSnapshot.mockRejectedValueOnce(new Error("Save failed"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.WARNING,
        error: "Save failed",
      });
    });

    test("should return warning when notify throws in timer/update", async () => {
      fakeTimer.update.mockReturnValue({ mode: TIMER_MODES.COMPLETED });
      mockNotify.mockRejectedValueOnce(new Error("Notify failed"));

      const result = await handleEvents("timer/update");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          severity: Constants.SEVERITY_LEVELS.WARNING,
          error: expect.stringContaining("Notify failed"),
        })
      );
    });

    test("should merge multiple warnings when multiple non-fatal errors occur", async () => {
      mockHandleSound.mockRejectedValueOnce(new Error("Sound failed"));
      mockSaveSnapshot.mockRejectedValueOnce(new Error("Save failed"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          severity: Constants.SEVERITY_LEVELS.WARNING,
          error: expect.stringMatching(/Sound failed[\s\S]*Save failed|Save failed[\s\S]*Sound failed/),
        })
      );
    });

    test("should return fatal error immediately when fatal error occurs before warnings", async () => {
      mockStopTick.mockRejectedValueOnce(new Error("Fatal error"));
      mockHandleSound.mockRejectedValueOnce(new Error("Warning error"));

      const result = await handleEvents("timer/pause");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Fatal error",
      });
      // handleSound should not be called because fatal error occurred first
      expect(mockHandleSound).not.toHaveBeenCalled();
    });

    test("should return unknown event error for invalid event type", async () => {
      const result = await handleEvents("invalid/event");

      expect(result).toEqual({
        success: false,
        severity: Constants.SEVERITY_LEVELS.FATAL,
        error: "Unknown event type: invalid/event",
      });
    });
  });
});
