import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { BGClient } from "@/ui/bg-client.js";
import { initTimer, getTimer } from "@/background/timer-store.js";
import { handleEvents } from "@/background/events.js";
import TimerState from "@/timer-state.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES, DURATIONS } = Constants;

vi.stubGlobal("alert", vi.fn());

/**
 * E2E Test: Complete User Timer Workflow
 *
 * Tests the full user journey from timer start through work session,
 * break session, and completion with proper notifications and state transitions.
 *
 * Requirements: 1.4 - E2E testing of complete user workflows
 */
describe("E2E: Complete User Timer Workflow", () => {
  let chromeMock;
  let bgClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();

    // Initialize background timer state
    await initTimer();

    // Create UI components
    bgClient = new BGClient();

    // Mock successful background responses for all timer operations
    chromeMock.runtime.sendMessage.mockImplementation(async (msg) => {
      // For non-event messages (like AUDIO_CONTROL), use default mock behavior
      if (!msg.type || !msg.type.includes("/")) {
        return { success: true };
      }

      try {
        const data = await handleEvents(msg?.type, msg);
        return data;
      } catch (error) {
        return { success: false, severity: "fatal", error: error.message };
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Full Timer Workflow", () => {
    it("should complete full timer workflow: start → work → break → completion", async () => {
      const totalMinutes = 60; // Longer timer to allow for multiple sessions
      const workDuration = DURATIONS.WORK_SESSION;
      const breakDuration = DURATIONS.BREAK_SESSION;

      // Step 1: Start timer
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      let timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(timer.getTotalRemaining()).toBe(totalMinutes * 60 * 1000);
      expect(timer.getSessionRemaining()).toBe(workDuration);

      // Verify alarm setup for timer ticking
      expect(chromeMock.alarms.create).toHaveBeenCalledWith("POMODORO_TICK", {
        periodInMinutes: 1,
      });

      // Step 2: Simulate work session completion
      const workCompleteTime = timer.totalStartTime + workDuration;
      vi.setSystemTime(workCompleteTime);

      const workUpdateResult = await bgClient.update();
      expect(workUpdateResult.success).toBe(true);
      expect(workUpdateResult.sessionType).toBe(SESSION_TYPES.BREAK);

      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);
      expect(timer.getSessionRemaining()).toBe(breakDuration);

      // Verify work session completion notification (Japanese)
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^switch\d+$/),
        expect.objectContaining({
          type: "basic",
          iconUrl: "resources/icon.png",
          title: "休憩開始",
          message: "ブロックを解除したよ。肩の力を抜こう",
        })
      );

      // Step 3: Simulate break session completion
      const breakCompleteTime = workCompleteTime + breakDuration;
      vi.setSystemTime(breakCompleteTime);

      const breakUpdateResult = await bgClient.update();
      expect(breakUpdateResult.success).toBe(true);
      expect(breakUpdateResult.sessionType).toBe(SESSION_TYPES.WORK);

      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify break session completion notification (Japanese)
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^switch\d+$/),
        expect.objectContaining({
          type: "basic",
          iconUrl: "resources/icon.png",
          title: "作業開始！",
          message: "SNSをブロックしたよ。作業に集中しよう",
        })
      );

      // Step 4: Simulate timer completion
      const timerCompleteTime = timer.totalStartTime + totalMinutes * 60 * 1000;
      vi.setSystemTime(timerCompleteTime);

      const completeUpdateResult = await bgClient.update();
      expect(completeUpdateResult.success).toBe(true);
      expect(completeUpdateResult.mode).toBe(TIMER_MODES.COMPLETED);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);
      expect(timer.getTotalRemaining()).toBe(0);

      // Verify timer completion notification (Japanese)
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^complete\d+$/),
        expect.objectContaining({
          type: "basic",
          iconUrl: "resources/icon.png",
          title: "ポモドーロ完了",
          message: "お疲れ様！また頑張ろう",
        })
      );
    });

    it("should handle pause and resume during work session", async () => {
      const totalMinutes = 60;

      // Start timer
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const startTime = timer.totalStartTime;

      // Simulate 10 minutes of work
      const pauseTime = startTime + 10 * 60 * 1000;
      vi.setSystemTime(pauseTime);

      // Pause timer
      const pauseResult = await bgClient.pause();
      expect(pauseResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.totalElapsed).toBe(10 * 60 * 1000);
      expect(timer.sessionElapsed).toBe(10 * 60 * 1000);

      // Simulate 5 minutes pause (should not affect timer)
      const resumeTime = pauseTime + 5 * 60 * 1000;
      vi.setSystemTime(resumeTime);

      // Resume timer
      const resumeResult = await bgClient.resume();
      expect(resumeResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.totalElapsed).toBe(10 * 60 * 1000); // Should still be 10 minutes
      expect(timer.sessionElapsed).toBe(10 * 60 * 1000);

      // Verify timer continues correctly after resume
      const afterResumeTime = resumeTime + 5 * 60 * 1000;
      vi.setSystemTime(afterResumeTime);

      const updateResult = await bgClient.update();
      expect(updateResult.success).toBe(true);

      timer = getTimer();
      expect(timer.totalElapsed).toBe(15 * 60 * 1000); // 10 + 5 minutes
      expect(timer.sessionElapsed).toBe(15 * 60 * 1000);
    });

    it("should handle reset during active session", async () => {
      const totalMinutes = 45;

      // Start timer and simulate some progress
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const startTime = timer.totalStartTime;

      // Simulate 15 minutes of work
      const resetTime = startTime + 15 * 60 * 1000;
      vi.setSystemTime(resetTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.totalElapsed).toBe(15 * 60 * 1000);

      // Reset timer
      const resetResult = await bgClient.reset();
      expect(resetResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.SETUP);
      expect(timer.totalElapsed).toBe(0);
      expect(timer.sessionElapsed).toBe(0);
      expect(timer.totalStartTime).toBe(null);
      expect(timer.sessionStartTime).toBe(null);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify alarms are cleared
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith("POMODORO_TICK");
    });

    it("should maintain state consistency across multiple sessions", async () => {
      // First session
      await bgClient.start(25);
      let timer = getTimer();
      const firstStartTime = timer.totalStartTime;

      // Complete first session
      const firstCompleteTime = firstStartTime + 25 * 60 * 1000;
      vi.setSystemTime(firstCompleteTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);

      // Reset for second session
      await bgClient.reset();
      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.SETUP);

      // Start second session
      const secondSessionTime = firstCompleteTime + 5 * 60 * 1000;
      vi.setSystemTime(secondSessionTime);

      await bgClient.start(30);
      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.totalDuration).toBe(30 * 60 * 1000);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(timer.totalStartTime).toBe(secondSessionTime);
      expect(timer.sessionStartTime).toBe(secondSessionTime);

      // Verify second session works independently
      const secondProgressTime = secondSessionTime + 10 * 60 * 1000;
      vi.setSystemTime(secondProgressTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.totalElapsed).toBe(10 * 60 * 1000);
      expect(timer.getTotalRemaining()).toBe(20 * 60 * 1000);
    });

    it("should handle edge case: very short timer duration", async () => {
      const totalMinutes = 5; // Minimum allowed duration

      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const startTime = timer.totalStartTime;

      // Since total duration (5 min) is less than work session (25 min),
      // the session duration should be limited to remaining total time
      expect(timer.sessionDuration).toBe(5 * 60 * 1000);

      // Complete the short timer
      const completeTime = startTime + 5 * 60 * 1000;
      vi.setSystemTime(completeTime);

      const updateResult = await bgClient.update();
      expect(updateResult.success).toBe(true);
      expect(updateResult.mode).toBe(TIMER_MODES.COMPLETED);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);
      expect(timer.getTotalRemaining()).toBe(0);

      // Should still trigger completion notification
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^complete\d+$/),
        expect.objectContaining({
          title: "ポモドーロ完了",
        })
      );
    });
  });

  describe("Notification System Integration", () => {
    it("should trigger notifications at correct times during workflow", async () => {
      const totalMinutes = 60;

      // Start timer
      await bgClient.start(totalMinutes);
      const timer = getTimer();
      const startTime = timer.totalStartTime;

      // Clear initial alarm creation calls
      chromeMock.notifications.create.mockClear();

      // Simulate work session completion
      const workCompleteTime = startTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      await bgClient.update();

      // Should trigger work session complete notification
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^switch\d+$/),
        expect.objectContaining({
          title: "休憩開始",
          message: "ブロックを解除したよ。肩の力を抜こう",
        })
      );

      chromeMock.notifications.create.mockClear();

      // Simulate break session completion
      const breakCompleteTime = workCompleteTime + DURATIONS.BREAK_SESSION;
      vi.setSystemTime(breakCompleteTime);

      await bgClient.update();

      // Should trigger break session complete notification
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^switch\d+$/),
        expect.objectContaining({
          title: "作業開始！",
          message: "SNSをブロックしたよ。作業に集中しよう",
        })
      );
    });

    it("should continue timer operation even if notification fails", async () => {
      const totalMinutes = 30;

      // Start timer
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Mock notification creation to fail after timer starts
      chromeMock.notifications.create.mockRejectedValue(
        new Error("Notification failed")
      );

      // Complete work session - notification will fail but timer should continue
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      const updateResult = await bgClient.update();

      // Result has warning due to notification failure, but timer state updated correctly
      expect(updateResult.success).toBe(false);
      expect(updateResult.severity).toBe("warning");
      expect(updateResult.warnings).toBeDefined();
      expect(updateResult.sessionType).toBe(SESSION_TYPES.BREAK);

      // Timer state should have switched to break despite notification failure
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
    });
  });

  describe("Site Blocking Integration", () => {
    it("should enable site blocking during work sessions", async () => {
      const totalMinutes = 30;

      // Start timer - should enable blocking
      await bgClient.start(totalMinutes);

      // Verify declarativeNetRequest rules were updated
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalled();

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
    });

    it("should disable site blocking during break sessions", async () => {
      const totalMinutes = 30;

      await bgClient.start(totalMinutes);
      const timer = getTimer();

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Complete work session to trigger break
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      await bgClient.update();

      // Verify blocking was disabled for break (includes both addRules and removeRuleIds)
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.any(Array),
      });
    });

    it("should disable site blocking on timer reset", async () => {
      const totalMinutes = 30;

      await bgClient.start(totalMinutes);
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Reset timer
      await bgClient.reset();

      // Verify blocking was disabled (includes both addRules and removeRuleIds)
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.any(Array),
      });
    });
  });

  describe("State Persistence Integration", () => {
    it("should maintain timer state consistency across operations", async () => {
      const totalMinutes = 45;

      // Start timer and make some progress
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const startTime = timer.totalStartTime;

      const progressTime = startTime + 15 * 60 * 1000;
      vi.setSystemTime(progressTime);

      await bgClient.update();
      timer = getTimer();

      // Verify timer state is consistent
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.totalDuration).toBe(totalMinutes * 60 * 1000);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);
      expect(timer.getTotalRemaining()).toBe(30 * 60 * 1000); // 45 - 15 = 30 minutes

      // Verify timer can create snapshots correctly
      const snapshot = timer.toSnapshot();
      expect(snapshot.mode).toBe(TIMER_MODES.RUNNING);
      expect(snapshot.totalStartTime).toBe(startTime);
      expect(snapshot.totalDuration).toBe(totalMinutes * 60 * 1000);
      expect(snapshot.sessionType).toBe(SESSION_TYPES.WORK);
      expect(snapshot.sessionStartTime).toBe(startTime);
      expect(snapshot.sessionDuration).toBe(DURATIONS.WORK_SESSION);
      expect(snapshot.pausedAt).toBe(null);
      expect(snapshot.soundEnabled).toBe(false);

      // Verify timer can be restored from snapshot
      const restoredTimer = TimerState.fromSnapshot(snapshot);
      expect(restoredTimer.mode).toBe(TIMER_MODES.RUNNING);
      expect(restoredTimer.totalDuration).toBe(totalMinutes * 60 * 1000);
      expect(restoredTimer.sessionType).toBe(SESSION_TYPES.WORK);
    });
  });
});
