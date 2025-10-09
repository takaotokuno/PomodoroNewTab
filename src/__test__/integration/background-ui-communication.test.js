import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import { BGClient } from "@/ui/bg-client.js";

// Import background modules to test integration
import { handleEvents } from "@/background/events.js";
import { initTimer, getTimer } from "@/background/timer-store.js";

describe("Background-UI Communication Integration", () => {
  let chromeMock;
  let bgClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromeMock = setupChromeMock();
    bgClient = new BGClient();

    // Initialize timer state for each test
    await initTimer();
  });

  describe("Message Passing", () => {
    it("should handle timer/update message correctly", async () => {
      // Mock chrome.runtime.sendMessage to simulate background response
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        mode: "setup",
        totalRemaining: 0,
        sessionType: "work",
        sessionRemaining: 0,
      });

      const result = await bgClient.update();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/update",
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBeDefined();
    });

    it("should handle timer/start message with valid minutes", async () => {
      const minutes = 25;
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      const result = await bgClient.start(minutes);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/start",
        minutes: 25,
      });
      expect(result.success).toBe(true);
    });

    it("should handle timer/pause message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      const result = await bgClient.pause();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/pause",
      });
      expect(result.success).toBe(true);
    });

    it("should handle timer/resume message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      const result = await bgClient.resume();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/resume",
      });
      expect(result.success).toBe(true);
    });

    it("should handle timer/reset message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      const result = await bgClient.reset();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/reset",
      });
      expect(result.success).toBe(true);
    });

    it("should handle background errors gracefully", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: "Test error",
      });

      const result = await bgClient.update();

      expect(result).toBeUndefined(); // BGClient returns undefined on error
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalled();
    });

    it("should handle chrome.runtime.sendMessage failures", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Connection failed")
      );

      const result = await bgClient.update();

      expect(result).toBeUndefined(); // BGClient returns undefined on error
    });
  });

  describe("Timer State Synchronization", () => {
    it("should synchronize timer state between background and UI", async () => {
      // Simulate background timer state change
      const timer = getTimer();
      timer.start(25);

      // Mock the background response to match the timer state
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        mode: timer.mode,
        totalRemaining: timer.getTotalRemaining(),
        sessionType: timer.sessionType,
        sessionRemaining: timer.getSessionRemaining(),
      });

      const result = await bgClient.update();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(timer.mode);
      expect(result.sessionType).toBe(timer.sessionType);
    });

    it("should validate minutes parameter in start command", async () => {
      // Test invalid minutes values
      await expect(bgClient.start(-1)).rejects.toThrow("Invalid minutes");
      await expect(bgClient.start(0)).rejects.toThrow("Invalid minutes");
      await expect(bgClient.start(4)).rejects.toThrow("Invalid minutes");
      await expect(bgClient.start(301)).rejects.toThrow("Invalid minutes");
      await expect(bgClient.start("25")).rejects.toThrow("Invalid minutes");
      await expect(bgClient.start(NaN)).rejects.toThrow("Invalid minutes");
    });

    it("should handle tab synchronization after timer operations", async () => {
      // Mock successful message response
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      // Mock tabs.query to return some tabs
      chromeMock.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await bgClient.start(25);

      // Verify that the message was sent (tab sync happens in background)
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/start",
        minutes: 25,
      });
    });
  });

  describe("Event Handler Integration", () => {
    it("should execute timer/update event correctly", async () => {
      const result = await handleEvents("timer/update");

      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("totalRemaining");
      expect(result).toHaveProperty("sessionType");
      expect(result).toHaveProperty("sessionRemaining");
    });

    it("should execute timer/start event with valid minutes", async () => {
      const minutes = 25;

      await handleEvents("timer/start", { minutes });

      const timer = getTimer();
      expect(timer.mode).toBe("running");
      expect(timer.sessionType).toBe("work");
    });

    it("should throw error for invalid minutes in timer/start event", async () => {
      await expect(handleEvents("timer/start", { minutes: 0 })).rejects.toThrow(
        "Invalid minutes"
      );
      await expect(
        handleEvents("timer/start", { minutes: -5 })
      ).rejects.toThrow("Invalid minutes");
      await expect(handleEvents("timer/start", {})).rejects.toThrow(
        "Invalid minutes"
      );
    });

    it("should execute timer/pause event correctly", async () => {
      // First start a timer
      await handleEvents("timer/start", { minutes: 25 });

      // Then pause it
      await handleEvents("timer/pause");

      const timer = getTimer();
      expect(timer.mode).toBe("paused");
    });

    it("should execute timer/resume event correctly", async () => {
      // Start and pause a timer
      await handleEvents("timer/start", { minutes: 25 });
      await handleEvents("timer/pause");

      // Then resume it
      await handleEvents("timer/resume");

      const timer = getTimer();
      expect(timer.mode).toBe("running");
    });

    it("should execute timer/reset event correctly", async () => {
      // Start a timer
      await handleEvents("timer/start", { minutes: 25 });

      // Then reset it
      await handleEvents("timer/reset");

      const timer = getTimer();
      expect(timer.mode).toBe("setup");
      expect(timer.getTotalRemaining()).toBe(0);
    });
  });
});
