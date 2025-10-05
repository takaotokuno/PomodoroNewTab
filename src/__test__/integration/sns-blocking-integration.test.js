import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { enableBlock, disableBlock } from "../../background/sites-guard.js";
import { routes } from "../../background/events.js";
import { initTimer, getTimer } from "../../background/timer-store.js";

describe("SNS Blocking Integration", () => {
  let chromeMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();

    // Initialize timer state for each test
    await initTimer();
  });

  describe("Block Rule Management", () => {
    it("should enable blocking rules when timer starts", async () => {
      const minutes = 25;

      await routes["timer/start"]({ minutes });

      // Verify that declarativeNetRequest.updateDynamicRules was called to add rules
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
              urlFilter: expect.stringContaining("x.com"),
              resourceTypes: ["main_frame"],
            },
          }),
        ]),
        removeRuleIds: [],
      });
    });

    it("should disable blocking rules when timer is reset", async () => {
      // First start a timer to enable blocking
      await routes["timer/start"]({ minutes: 25 });
      vi.clearAllMocks();

      // Then reset it
      await routes["timer/reset"]();

      // Verify that declarativeNetRequest.updateDynamicRules was called to remove rules
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: expect.arrayContaining([
          expect.any(Number), // Rule IDs should be numbers
        ]),
      });
    });

    it("should create blocking rules for all target SNS sites", async () => {
      await enableBlock();

      const call =
        chromeMock.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      const rules = call.addRules;

      // Verify rules are created for major SNS sites
      const expectedDomains = [
        "x.com",
        "twitter.com",
        "instagram.com",
        "facebook.com",
        "tiktok.com",
        "youtube.com",
        "reddit.com",
        "pixiv.net",
        "nicovideo.jp",
      ];

      expectedDomains.forEach((domain) => {
        const ruleExists = rules.some((rule) =>
          rule.condition.urlFilter.includes(domain)
        );
        expect(ruleExists).toBe(true);
      });
    });
  });

  describe("Active vs Inactive Tab Handling", () => {
    it("should reload active SNS tab when blocking is enabled", async () => {
      // Mock tabs.query to return SNS tabs
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
      ];
      chromeMock.tabs.query.mockResolvedValue(mockTabs);

      // Mock active tab query to return the first tab as active
      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockTabs[0]]); // Second call for active tab

      await enableBlock();

      // Verify that the active tab (id: 1) was reloaded
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(1);

      // Verify that the inactive tab (id: 2) was closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(2);
    });

    it("should close inactive SNS tabs when blocking is enabled", async () => {
      // Mock tabs.query to return SNS tabs
      const mockTabs = [
        { id: 1, url: "https://instagram.com/explore" },
        { id: 2, url: "https://youtube.com/watch?v=123" },
        { id: 3, url: "https://reddit.com/r/programming" },
      ];
      chromeMock.tabs.query.mockResolvedValue(mockTabs);

      // Mock active tab query to return the second tab as active
      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockTabs[1]]); // Second call for active tab

      await enableBlock();

      // Verify that the active tab (id: 2) was reloaded
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(2);

      // Verify that inactive tabs (id: 1, 3) were closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(1);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(3);
    });

    it("should handle case when no active tab is found", async () => {
      // Mock tabs.query to return SNS tabs
      const mockTabs = [
        { id: 1, url: "https://tiktok.com/@user" },
        { id: 2, url: "https://pixiv.net/artworks/123" },
      ];
      chromeMock.tabs.query.mockResolvedValue(mockTabs);

      // Mock active tab query to return empty array (no active tab)
      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([]); // Second call for active tab (empty)

      await enableBlock();

      // When no active tab is found, all tabs should be closed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(1);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(2);
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
    });

    it("should handle tab operation errors gracefully", async () => {
      // Mock tabs.query to return SNS tabs
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
      ];
      chromeMock.tabs.query.mockResolvedValue(mockTabs);

      // Mock active tab query
      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockTabs[0]]); // Second call for active tab

      // Mock tab operations to fail
      chromeMock.tabs.reload.mockRejectedValue(new Error("No tab with id: 1"));
      chromeMock.tabs.remove.mockRejectedValue(new Error("No tab with id: 2"));

      // Should not throw error despite tab operation failures
      await expect(enableBlock()).resolves.not.toThrow();
    });
  });

  describe("Timer State Integration", () => {
    it("should enable blocking when work session starts", async () => {
      await routes["timer/start"]({ minutes: 25 });

      const timer = getTimer();
      expect(timer.mode).toBe("running");
      expect(timer.sessionType).toBe("work");

      // Verify blocking was enabled
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          addRules: expect.arrayContaining([expect.any(Object)]),
        })
      );
    });

    it("should disable blocking when timer is reset", async () => {
      // Start timer first
      await routes["timer/start"]({ minutes: 25 });
      vi.clearAllMocks();

      // Reset timer
      await routes["timer/reset"]();

      const timer = getTimer();
      expect(timer.mode).toBe("setup");

      // Verify blocking was disabled
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          removeRuleIds: expect.arrayContaining([expect.any(Number)]),
        })
      );
    });

    it("should handle session transitions correctly", async () => {
      // Mock timer update to simulate session completion
      const timer = getTimer();
      timer.start(25);

      // Simulate work session completion by manually triggering session switch
      timer.sessionElapsed = timer.sessionDuration + 1000; // Exceed session duration

      const result = await routes["timer/update"]();

      // Verify the update returns session information
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("sessionType");
      expect(result).toHaveProperty("totalRemaining");
      expect(result).toHaveProperty("sessionRemaining");
    });

    it("should maintain blocking state during pause and resume", async () => {
      // Start timer (enables blocking)
      await routes["timer/start"]({ minutes: 25 });
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Pause timer (should not change blocking state)
      await routes["timer/pause"]();
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();

      // Resume timer (should not change blocking state)
      await routes["timer/resume"]();
      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).not.toHaveBeenCalled();

      const timer = getTimer();
      expect(timer.mode).toBe("running");
    });
  });

  describe("Error Handling", () => {
    it("should handle declarativeNetRequest API failures", async () => {
      chromeMock.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error("Extension context invalidated")
      );

      await expect(enableBlock()).rejects.toThrow(
        "Extension context invalidated"
      );
    });

    it("should handle tabs.query permission errors", async () => {
      chromeMock.tabs.query.mockRejectedValue(
        new Error("Cannot access chrome://newtab/")
      );

      await expect(enableBlock()).rejects.toThrow(
        "Cannot access chrome://newtab/"
      );
    });

    it("should continue processing other tabs when individual operations fail", async () => {
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
        { id: 3, url: "https://instagram.com/explore" },
      ];

      chromeMock.tabs.query.mockResolvedValue(mockTabs);
      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockTabs[0]]); // Second call for active tab

      // Make the first tab reload fail, but others should succeed
      chromeMock.tabs.reload.mockRejectedValueOnce(new Error("Tab closed"));
      chromeMock.tabs.remove
        .mockResolvedValueOnce(undefined) // Tab 2 closes successfully
        .mockResolvedValueOnce(undefined); // Tab 3 closes successfully

      // Should not throw despite one tab operation failing
      await expect(enableBlock()).resolves.not.toThrow();

      // Verify other tabs were still processed
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(2);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(3);
    });
  });
});
