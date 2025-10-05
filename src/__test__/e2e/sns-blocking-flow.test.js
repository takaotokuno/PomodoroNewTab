import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { BGClient } from "../../ui/bg-client.js";
import { initTimer, getTimer } from "../../background/timer-store.js";
import { routes } from "../../background/events.js";
import Constants from "../../constants.js";

const { TIMER_MODES, SESSION_TYPES, DURATIONS } = Constants;

/**
 * E2E Test: SNS Blocking User Experience
 *
 * Tests the complete SNS blocking functionality during work sessions,
 * including active tab handling, inactive tab closure, and proper
 * integration with timer state changes.
 *
 * Requirements: 1.4, 2.1, 2.2, 2.3 - E2E testing of SNS blocking functionality
 */
describe("E2E: SNS Blocking User Experience", () => {
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
      const fn = routes[msg?.type];
      if (!fn) return { success: false, error: "unknown route" };

      const data = await fn(msg);
      return { success: true, ...data };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SNS Blocking During Work Session", () => {
    it("should block SNS sites when timer starts work session", async () => {
      const totalMinutes = 60;

      // Mock SNS tabs that will be found
      const mockSNSTabs = [
        { id: 1, url: "https://twitter.com/home", active: true },
        { id: 2, url: "https://facebook.com/feed", active: false },
        { id: 3, url: "https://instagram.com/explore", active: false },
        { id: 4, url: "https://youtube.com/watch?v=123", active: false },
      ];

      // Mock tab queries - need to handle multiple calls
      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 1, active: true }]); // Active tab query
        } else if (query.url) {
          return Promise.resolve(mockSNSTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Start timer (should trigger SNS blocking)
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify declarativeNetRequest rules were added
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            priority: 1,
            action: {
              type: "redirect",
              redirect: { extensionPath: "/src/ui/ui.html" },
            },
            condition: {
              urlFilter: expect.stringMatching(/\|\|.*\^/),
              resourceTypes: ["main_frame"],
            },
          }),
        ]),
        removeRuleIds: [],
      });

      // Verify tab handling: active tab reloaded, inactive tabs closed
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(1); // Active tab reloaded
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(2); // Inactive tab closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(3); // Inactive tab closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(4); // Inactive tab closed
    });

    it("should handle active tab properly during SNS blocking", async () => {
      const totalMinutes = 30;

      // Mock only active SNS tab
      const activeTwitterTab = {
        id: 5,
        url: "https://x.com/home",
        active: true,
      };

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([activeTwitterTab]); // Active tab query
        } else if (query.url) {
          return Promise.resolve([activeTwitterTab]); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Start timer
      await bgClient.start(totalMinutes);

      // Verify active tab is reloaded (not closed)
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(5);
      expect(chromeMock.tabs.remove).not.toHaveBeenCalledWith(5);
    });

    it("should handle inactive tabs properly during SNS blocking", async () => {
      const totalMinutes = 45;

      // Mock only inactive SNS tabs
      const inactiveTabs = [
        { id: 10, url: "https://reddit.com/r/programming", active: false },
        { id: 11, url: "https://tiktok.com/@user", active: false },
        { id: 12, url: "https://pixiv.net/artworks/123", active: false },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 99, active: true }]); // Different active tab
        } else if (query.url) {
          return Promise.resolve(inactiveTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Start timer
      await bgClient.start(totalMinutes);

      // Verify all inactive tabs are closed (not reloaded)
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(10);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(11);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(12);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(10);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(11);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(12);
    });

    it("should handle mixed active and inactive SNS tabs correctly", async () => {
      const totalMinutes = 25;

      // Mock mixed SNS tabs
      const mixedTabs = [
        { id: 20, url: "https://youtube.com/watch?v=abc", active: false },
        { id: 21, url: "https://instagram.com/stories", active: true },
        { id: 22, url: "https://facebook.com/groups", active: false },
        { id: 23, url: "https://nicovideo.jp/watch/sm123", active: false },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 21, active: true }]); // Active tab query
        } else if (query.url) {
          return Promise.resolve(mixedTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Start timer
      await bgClient.start(totalMinutes);

      // Verify active tab (21) is reloaded
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(21);
      expect(chromeMock.tabs.remove).not.toHaveBeenCalledWith(21);

      // Verify inactive tabs are closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(20);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(22);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(23);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(20);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(22);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalledWith(23);
    });
  });

  describe("SNS Blocking State Transitions", () => {
    it("should disable SNS blocking when entering break session", async () => {
      const totalMinutes = 60;

      // Start timer (enables blocking)
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Simulate work session completion (should disable blocking)
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      const updateResult = await bgClient.update();
      expect(updateResult.success).toBe(true);
      expect(updateResult.sessionType).toBe(SESSION_TYPES.BREAK);

      // Verify blocking rules were removed
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([
          10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108,
        ]),
      });
    });

    it("should re-enable SNS blocking when returning to work session", async () => {
      const totalMinutes = 90;

      // Start timer and complete work session
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);

      // Clear previous calls and setup mocks for re-blocking
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();
      chromeMock.tabs.query.mockClear();

      // Mock SNS tabs for re-blocking
      const mockSNSTabs = [
        { id: 30, url: "https://twitter.com/notifications", active: false },
        { id: 31, url: "https://youtube.com/trending", active: true },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 31, active: true }]); // Active tab query
        } else if (query.url) {
          return Promise.resolve(mockSNSTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Complete break session (should re-enable blocking)
      const breakCompleteTime = workCompleteTime + DURATIONS.BREAK_SESSION;
      vi.setSystemTime(breakCompleteTime);

      const breakUpdateResult = await bgClient.update();
      expect(breakUpdateResult.success).toBe(true);
      expect(breakUpdateResult.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify blocking rules were re-added
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            action: {
              type: "redirect",
              redirect: { extensionPath: "/src/ui/ui.html" },
            },
          }),
        ]),
        removeRuleIds: [],
      });

      // Verify tabs were processed again
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(31); // Active tab
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(30); // Inactive tab
    });

    it("should not change SNS blocking when timer is paused during work session", async () => {
      const totalMinutes = 40;

      // Start timer (enables blocking)
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Pause timer (should NOT change blocking - still in work session)
      const pauseResult = await bgClient.pause();
      expect(pauseResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK); // Still work session

      // Verify blocking rules were NOT changed (pause doesn't affect session type)
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();
    });

    it("should not change SNS blocking when timer is resumed during work session", async () => {
      const totalMinutes = 50;

      // Start and pause timer
      await bgClient.start(totalMinutes);
      await bgClient.pause();

      let timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();
      chromeMock.tabs.query.mockClear();

      // Resume timer (should NOT change blocking - still in work session)
      const resumeResult = await bgClient.resume();
      expect(resumeResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK); // Still work session

      // Verify blocking rules were NOT changed (resume doesn't affect session type)
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();
      expect(chromeMock.tabs.query).not.toHaveBeenCalled();
    });

    it("should not enable SNS blocking when resuming during break session", async () => {
      const totalMinutes = 80;

      // Start timer and reach break session
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);

      // Pause during break
      await bgClient.pause();
      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.PAUSED);
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();
      chromeMock.tabs.query.mockClear();

      // Resume during break (should NOT enable blocking)
      const resumeResult = await bgClient.resume();
      expect(resumeResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);

      // Verify blocking rules were NOT added (break session allows SNS)
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();
      expect(chromeMock.tabs.query).not.toHaveBeenCalled();
    });

    it("should disable SNS blocking when timer is reset", async () => {
      const totalMinutes = 35;

      // Start timer (enables blocking)
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Reset timer (should disable blocking)
      const resetResult = await bgClient.reset();
      expect(resetResult.success).toBe(true);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.SETUP);

      // Verify blocking rules were removed
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([
          10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108,
        ]),
      });
    });

    it("should disable SNS blocking when timer completes", async () => {
      const totalMinutes = 30;

      // Start timer (enables blocking)
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      const startTime = timer.totalStartTime;

      // Clear previous calls
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Complete timer (should disable blocking)
      const completeTime = startTime + totalMinutes * 60 * 1000;
      vi.setSystemTime(completeTime);

      const updateResult = await bgClient.update();
      expect(updateResult.success).toBe(true);
      expect(updateResult.mode).toBe(TIMER_MODES.COMPLETED);

      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);

      // Verify blocking rules were removed
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([
          10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108,
        ]),
      });
    });
  });

  describe("Error Handling in SNS Blocking", () => {
    it("should handle tab query failures gracefully", async () => {
      const totalMinutes = 25;

      // Mock tab query to fail for SNS tabs but succeed for active tab
      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 1, active: true }]); // Active tab query succeeds
        } else if (query.url) {
          return Promise.reject(new Error("Permission denied")); // SNS tabs query fails
        }
        return Promise.resolve([]);
      });

      // Start timer should fail when tab operations fail (because enableBlock fails)
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult).toBeUndefined(); // BGClient returns undefined on error

      // Timer is actually started even if tab operations fail (timer.start() happens before enableBlock())
      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Verify declarativeNetRequest rules were still added
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            action: {
              type: "redirect",
              redirect: { extensionPath: "/src/ui/ui.html" },
            },
          }),
        ]),
        removeRuleIds: [],
      });
    });

    it("should handle individual tab operation failures gracefully", async () => {
      const totalMinutes = 40;

      // Mock SNS tabs with some that will fail operations
      const mockSNSTabs = [
        { id: 50, url: "https://twitter.com/home", active: true },
        { id: 51, url: "https://facebook.com/feed", active: false },
        { id: 52, url: "https://instagram.com/explore", active: false },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 50, active: true }]); // Active tab query
        } else if (query.url) {
          return Promise.resolve(mockSNSTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Mock tab operations to fail for some tabs
      chromeMock.tabs.reload.mockRejectedValue(new Error("Tab not found"));
      chromeMock.tabs.remove
        .mockResolvedValueOnce(undefined) // First remove succeeds
        .mockRejectedValue(new Error("Tab already closed")); // Second remove fails

      // Start timer should still succeed
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // Verify all tab operations were attempted despite failures
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(50);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(51);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(52);
    });

    it("should handle declarativeNetRequest failures gracefully", async () => {
      const totalMinutes = 20;

      // Mock declarativeNetRequest to fail
      chromeMock.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error("Extension context invalidated")
      );

      // Start timer should fail if blocking rules cannot be set
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult).toBeUndefined(); // BGClient returns undefined on error

      // Timer is actually started even if declarativeNetRequest fails (timer.start() happens before enableBlock())
      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);
    });

    it("should handle no active tab scenario", async () => {
      const totalMinutes = 15;

      // Mock no active tab found
      const mockSNSTabs = [
        { id: 60, url: "https://youtube.com/watch?v=xyz", active: false },
        { id: 61, url: "https://reddit.com/r/test", active: false },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([]); // No active tab
        } else if (query.url) {
          return Promise.resolve(mockSNSTabs); // SNS tabs query
        }
        return Promise.resolve([]);
      });

      // Start timer should still work
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      // All SNS tabs should be treated as inactive (closed)
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(60);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(61);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
    });

    it("should handle no SNS tabs scenario", async () => {
      const totalMinutes = 55;

      // Mock no SNS tabs found
      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 99, active: true }]); // Active tab query
        } else if (query.url) {
          return Promise.resolve([]); // No SNS tabs
        }
        return Promise.resolve([]);
      });

      // Start timer should work normally
      const startResult = await bgClient.start(totalMinutes);
      expect(startResult.success).toBe(true);

      const timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.RUNNING);

      // No SNS tab operations should be performed (but active tab query still happens)
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();

      // But blocking rules should still be set
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            action: {
              type: "redirect",
              redirect: { extensionPath: "/src/ui/ui.html" },
            },
          }),
        ]),
        removeRuleIds: [],
      });
    });
  });

  describe("SNS Blocking Integration with Timer Workflow", () => {
    it("should integrate SNS blocking seamlessly with complete timer workflow", async () => {
      const totalMinutes = 60;

      // Mock SNS tabs throughout the workflow
      const mockSNSTabs = [
        { id: 70, url: "https://x.com/home", active: true },
        { id: 71, url: "https://tiktok.com/@user", active: false },
      ];

      chromeMock.tabs.query.mockImplementation((query) => {
        if (query.active && query.currentWindow) {
          return Promise.resolve([{ id: 70, active: true }]); // Active tab queries
        } else if (query.url) {
          return Promise.resolve(mockSNSTabs); // SNS tabs queries
        }
        return Promise.resolve([]);
      });

      // Step 1: Start timer (should enable blocking)
      await bgClient.start(totalMinutes);
      let timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify initial blocking
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          addRules: expect.arrayContaining([expect.any(Object)]),
          removeRuleIds: [],
        })
      );

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Step 2: Complete work session (should disable blocking)
      const workCompleteTime = timer.totalStartTime + DURATIONS.WORK_SESSION;
      vi.setSystemTime(workCompleteTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.BREAK);

      // Verify blocking disabled for break
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([expect.any(Number)]),
      });

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Step 3: Complete break session (should re-enable blocking)
      const breakCompleteTime = workCompleteTime + DURATIONS.BREAK_SESSION;
      vi.setSystemTime(breakCompleteTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

      // Verify blocking re-enabled for work
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          addRules: expect.arrayContaining([expect.any(Object)]),
          removeRuleIds: [],
        })
      );

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Step 4: Complete timer (should disable blocking)
      const completeTime = timer.totalStartTime + totalMinutes * 60 * 1000;
      vi.setSystemTime(completeTime);

      await bgClient.update();
      timer = getTimer();
      expect(timer.mode).toBe(TIMER_MODES.COMPLETED);

      // Verify final blocking disabled
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([expect.any(Number)]),
      });
    });
  });
});
