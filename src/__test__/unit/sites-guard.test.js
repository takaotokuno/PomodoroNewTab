/**
 * Unit tests for sites-guard.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { enableBlock, disableBlock } from "@/background/sites-guard.js";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";
const { BLOCK_SITES } = Constants;

vi.mock("@/background/timer-store.js", () => ({
  getTimer: vi.fn(() => ({ reset: vi.fn() })),
}));

describe("SitesGuard", () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = setupChromeMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("enableBlock()", () => {
    test("should add blocking rules for all target sites", async () => {
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
      ];
      chromeMock.tabs.query.mockResolvedValue(mockTabs);

      await enableBlock();

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
    });

    test("should create rules for all target domains", async () => {
      chromeMock.tabs.query.mockResolvedValue([]);

      await enableBlock();

      const call =
        chromeMock.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      const rules = call.addRules;

      expect(rules).toHaveLength(BLOCK_SITES.length);

      BLOCK_SITES.forEach((domain, index) => {
        expect(rules[index]).toEqual({
          id: 10100 + index,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { extensionPath: "/src/ui/ui.html" },
          },
          condition: {
            urlFilter: `||${domain}^`,
            resourceTypes: ["main_frame"],
          },
        });
      });
    });

    test("should reload matching tabs after enabling block", async () => {
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
      ];
      const mockActiveTab = { id: 1, url: "https://twitter.com/home" };

      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockActiveTab]); // Second call for active tab

      await enableBlock();

      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        url: expect.arrayContaining([
          "*://*.x.com/*",
          "*://x.com/*",
          "*://*.twitter.com/*",
          "*://twitter.com/*",
          "*://*.instagram.com/*",
          "*://instagram.com/*",
          "*://*.facebook.com/*",
          "*://facebook.com/*",
          "*://*.tiktok.com/*",
          "*://tiktok.com/*",
          "*://*.youtube.com/*",
          "*://youtube.com/*",
          "*://*.reddit.com/*",
          "*://reddit.com/*",
          "*://*.pixiv.net/*",
          "*://pixiv.net/*",
          "*://*.nicovideo.jp/*",
          "*://nicovideo.jp/*",
        ]),
      });

      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });

      // Active tab (id: 1) should be reloaded
      expect(chromeMock.tabs.reload).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.reload).toHaveBeenCalledWith(1);

      // Inactive tab (id: 2) should be removed
      expect(chromeMock.tabs.remove).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith(2);
    });

    test("should throw error when tab operations fail", async () => {
      const mockTabs = [
        { id: 1, url: "https://twitter.com/home" },
        { id: 2, url: "https://facebook.com/feed" },
      ];
      const mockActiveTab = { id: 1, url: "https://twitter.com/home" };

      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs
        .mockResolvedValueOnce([mockActiveTab]); // Second call for active tab

      chromeMock.tabs.reload.mockRejectedValueOnce(new Error("Tab closed"));
      chromeMock.tabs.remove.mockRejectedValueOnce(
        new Error("Tab already closed")
      );

      await expect(enableBlock()).rejects.toThrow(
        "Failed to process 2 out of 2 SNS tabs"
      );

      expect(chromeMock.tabs.reload).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.remove).toHaveBeenCalledTimes(1);
    });

    test("should handle empty tabs list", async () => {
      chromeMock.tabs.query.mockResolvedValue([]);

      await expect(enableBlock()).resolves.not.toThrow();

      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
    });
  });

  describe("disableBlock()", () => {
    test("should remove all blocking rules", async () => {
      await disableBlock();

      expect(
        chromeMock.declarativeNetRequest.updateDynamicRules
      ).toHaveBeenCalledWith({
        addRules: [],
        removeRuleIds: [
          10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108, 10109,
          10110, 10111,
        ],
      });
    });

    test("should not reload tabs when disabling", async () => {
      await disableBlock();

      expect(chromeMock.tabs.query).not.toHaveBeenCalled();
      expect(chromeMock.tabs.reload).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("enableBlock should throw error when declarativeNetRequest fails", async () => {
      chromeMock.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error("Permission denied")
      );

      await expect(enableBlock()).rejects.toThrow("Permission denied");
    });

    test("disableBlock should throw error when declarativeNetRequest fails", async () => {
      chromeMock.declarativeNetRequest.updateDynamicRules.mockRejectedValue(
        new Error("Permission denied")
      );

      await expect(disableBlock()).rejects.toThrow("Permission denied");
    });

    test("enableBlock should throw error when tabs.query fails", async () => {
      chromeMock.tabs.query.mockRejectedValue(
        new Error("Tabs permission denied")
      );

      await expect(enableBlock()).rejects.toThrow(
        "Failed to query tabs: Tabs permission denied"
      );
    });

    test("enableBlock should handle active tab query errors gracefully", async () => {
      const mockTabs = [{ id: 1, url: "https://twitter.com/home" }];

      chromeMock.tabs.query
        .mockResolvedValueOnce(mockTabs) // First call for SNS tabs succeeds
        .mockRejectedValueOnce(new Error("Failed to get active tab")); // Second call for active tab fails

      await expect(enableBlock()).resolves.not.toThrow();

      // Should still process the tabs even if active tab query fails
      expect(chromeMock.tabs.query).toHaveBeenCalledTimes(2);
    });
  });
});
