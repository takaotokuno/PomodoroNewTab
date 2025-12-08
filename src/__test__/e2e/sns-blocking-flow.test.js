import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { BGClient } from "@/ui/bg-client.js";
import { initTimer, getTimer } from "@/background/timer-store.js";
import { handleEvents } from "@/background/events.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES, DURATIONS } = Constants;
vi.stubGlobal("alert", vi.fn());

/**
 * E2E Test: SNS Blocking User Experience
 * Tests complete SNS blocking functionality during work sessions
 */
describe("E2E: SNS Blocking User Experience", () => {
  let chromeMock;
  let bgClient;

  // Helper functions
  const setupTabMocks = (snsTabs = [], activeTabId = null) => {
    chromeMock.tabs.query.mockImplementation((queryInfo) => {
      if (queryInfo.active && queryInfo.currentWindow) {
        return Promise.resolve(
          activeTabId ? [{ id: activeTabId, active: true }] : []
        );
      } else if (queryInfo.url) {
        return Promise.resolve(snsTabs);
      }
      return Promise.resolve([]);
    });
  };

  const expectBlockingRules = (action = "add") => {
    const expectation =
      action === "add"
        ? {
            addRules: expect.arrayContaining([expect.any(Object)]),
            removeRuleIds: [],
          }
        : {
            addRules: [],
            removeRuleIds: expect.arrayContaining([expect.any(Number)]),
          };

    expect(
      chromeMock.declarativeNetRequest.updateDynamicRules
    ).toHaveBeenCalledWith(expectation);
  };

  const advanceToSession = async (sessionType) => {
    const timer = getTimer();
    const duration =
      sessionType === SESSION_TYPES.BREAK
        ? DURATIONS.WORK_SESSION
        : DURATIONS.WORK_SESSION + DURATIONS.BREAK_SESSION;

    vi.setSystemTime(timer.totalStartTime + duration);
    return await bgClient.update();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();
    await initTimer();
    bgClient = new BGClient();

    chromeMock.runtime.sendMessage.mockImplementation(async (msg) => {
      // For non-event messages (like AUDIO_CONTROL), use default mock behavior
      if (!msg.type || !msg.type.includes('/')) {
        return { success: true };
      }
      
      try {
        let data = await handleEvents(msg.type, msg);
        if (!data) data = { success: true };
        else if ("success" in data === false) data.success = true;
        return data;
      } catch (e) {
        return {
          success: false,
          severity: "fatal",
          error: String(e?.message || e),
        };
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SNS Blocking During Work Session", () => {
    it("should handle different tab configurations correctly", async () => {
      const testCases = [
        {
          name: "mixed active and inactive tabs",
          snsTabs: [
            { id: 1, url: "https://twitter.com/home", active: true },
            { id: 2, url: "https://facebook.com/feed", active: false },
            { id: 3, url: "https://instagram.com/explore", active: false },
          ],
          activeTabId: 1,
          expectedReloads: [1],
          expectedRemovals: [2, 3],
        },
        {
          name: "only active tab",
          snsTabs: [{ id: 5, url: "https://x.com/home", active: true }],
          activeTabId: 5,
          expectedReloads: [5],
          expectedRemovals: [],
        },
        {
          name: "only inactive tabs",
          snsTabs: [
            { id: 10, url: "https://reddit.com/r/programming", active: false },
            { id: 11, url: "https://tiktok.com/@user", active: false },
          ],
          activeTabId: 99,
          expectedReloads: [],
          expectedRemovals: [10, 11],
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        await initTimer();

        setupTabMocks(testCase.snsTabs, testCase.activeTabId);

        const result = await bgClient.start(30);
        expect(result.success).toBe(true);

        const timer = getTimer();
        expect(timer.mode).toBe(TIMER_MODES.RUNNING);
        expect(timer.sessionType).toBe(SESSION_TYPES.WORK);

        expectBlockingRules("add");

        testCase.expectedReloads.forEach((id) => {
          expect(chromeMock.tabs.reload).toHaveBeenCalledWith(id);
        });

        testCase.expectedRemovals.forEach((id) => {
          expect(chromeMock.tabs.remove).toHaveBeenCalledWith(id);
        });
      }
    });
  });

  describe("SNS Blocking State Transitions", () => {
    it("should handle session transitions correctly", async () => {
      setupTabMocks([{ id: 1, url: "https://twitter.com", active: false }], 2);

      // Start work session
      await bgClient.start(60);
      expect(getTimer().sessionType).toBe(SESSION_TYPES.WORK);
      expectBlockingRules("add");

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Transition to break
      await advanceToSession(SESSION_TYPES.BREAK);
      expect(getTimer().sessionType).toBe(SESSION_TYPES.BREAK);
      expectBlockingRules("remove");

      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Return to work
      await advanceToSession(SESSION_TYPES.WORK);
      expect(getTimer().sessionType).toBe(SESSION_TYPES.WORK);
      expectBlockingRules("add");
    });

    it("should not affect blocking during pause/resume operations", async () => {
      setupTabMocks();

      await bgClient.start(40);
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      // Pause/resume during work - no blocking changes
      await bgClient.pause();
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();

      await bgClient.resume();
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();

      // Move to break, then pause/resume - no blocking changes
      await advanceToSession(SESSION_TYPES.BREAK);
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      await bgClient.pause();
      await bgClient.resume();
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();
    });

    it("should disable blocking on timer reset and completion", async () => {
      setupTabMocks();

      // Test reset
      await bgClient.start(35);
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      await bgClient.reset();
      expect(getTimer().mode).toBe(TIMER_MODES.SETUP);
      expectBlockingRules("remove");

      // Test completion
      await bgClient.start(30);
      const timer = getTimer();
      chromeMock.declarativeNetRequest.updateDynamicRules.mockClear();

      vi.setSystemTime(timer.totalStartTime + 30 * 60 * 1000);
      await bgClient.update();
      expect(getTimer().mode).toBe(TIMER_MODES.COMPLETED);
      expectBlockingRules("remove");
    });
  });

  describe("Error Handling in SNS Blocking", () => {
    it("should handle various error scenarios gracefully", async () => {
      vi.stubGlobal("alert", vi.fn());

      const errorScenarios = [
        {
          name: "tab query failure",
          setup: () => {
            chromeMock.tabs.query.mockImplementation((query) => {
              if (query.active)
                return Promise.resolve([{ id: 1, active: true }]);
              if (query.url)
                return Promise.reject(new Error("Permission denied"));
              return Promise.resolve([]);
            });
          },
          severity: "warning",
        },
        {
          name: "tab operation failures",
          setup: () => {
            setupTabMocks(
              [
                { id: 50, url: "https://twitter.com", active: true },
                { id: 51, url: "https://facebook.com", active: false },
              ],
              50
            );
            chromeMock.tabs.reload.mockRejectedValue(
              new Error("Tab not found")
            );
            chromeMock.tabs.remove.mockRejectedValue(new Error("Tab closed"));
          },
          severity: "warning",
        },
        {
          name: "declarativeNetRequest failure",
          setup: () => {
            setupTabMocks();
            chromeMock.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
              new Error("Extension context invalidated")
            );
          },
          severity: "fatal",
        },
      ];

      for (const scenario of errorScenarios) {
        vi.clearAllMocks();
        await initTimer();
        scenario.setup();

        let result = await bgClient.start(25);

        expect(result.success).toBe(false);
        expect(alert).toHaveBeenCalled();

        // if case of a fatal error, timer should revert to SETUP mode
        if (scenario.severity === "warning") {
          expect(getTimer().mode).toBe(TIMER_MODES.RUNNING);
        }

        if (scenario.severity === "fatal") {
          expect(getTimer().mode).toBe(TIMER_MODES.SETUP);
        }
      }
    });

    it("should handle edge cases with tab configurations", async () => {
      // No active tab
      setupTabMocks(
        [{ id: 60, url: "https://youtube.com", active: false }],
        null
      );
      let result = await bgClient.start(15);
      expect(result.success).toBe(true);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(60);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();

      vi.clearAllMocks();
      await initTimer();

      // No SNS tabs
      setupTabMocks([], 99);
      result = await bgClient.start(20);
      expect(result.success).toBe(true);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
      expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
      expectBlockingRules("add");
    });
  });
});
