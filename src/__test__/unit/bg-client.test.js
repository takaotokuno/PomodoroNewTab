/**
 * Unit tests for bg-client.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { BGClient } from "@/ui/bg-client.js";
import { setupChromeMock } from "../setup.chrome.js";

describe("BGClient", () => {
  let bgClient;
  let chromeMock;

  beforeEach(() => {
    chromeMock = setupChromeMock();
    bgClient = new BGClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("update()", () => {
    test("should send timer/update message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient.update();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/update",
      });
      expect(result).toEqual({ success: true });
    });

    test("should handle background error response", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: "Timer not initialized",
      });

      const result = await bgClient.update();

      expect(result).toBeUndefined();
    });

    test("should handle chrome runtime error", async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Runtime error")
      );

      const result = await bgClient.update();

      expect(result).toBeUndefined();
    });
  });

  describe("start()", () => {
    test("should send timer/start message with valid minutes", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient.start(25);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/start",
        minutes: 25,
      });
      expect(result).toEqual({ success: true });
    });

    test("should throw error for invalid minutes - too low", async () => {
      await expect(bgClient.start(3)).rejects.toThrow("Invalid minutes");
    });

    test("should throw error for invalid minutes - too high", async () => {
      await expect(bgClient.start(350)).rejects.toThrow("Invalid minutes");
    });

    test("should throw error for non-number minutes", async () => {
      await expect(bgClient.start("25")).rejects.toThrow("Invalid minutes");
    });

    test("should throw error for NaN minutes", async () => {
      await expect(bgClient.start(NaN)).rejects.toThrow("Invalid minutes");
    });

    test("should accept boundary values", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      await expect(bgClient.start(5)).resolves.toEqual({ success: true });
      await expect(bgClient.start(300)).resolves.toEqual({ success: true });
    });
  });

  describe("pause()", () => {
    test("should send timer/pause message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient.pause();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/pause",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("resume()", () => {
    test("should send timer/resume message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient.resume();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/resume",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("reset()", () => {
    test("should send timer/reset message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient.reset();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "timer/reset",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("_send()", () => {
    test("should send message with payload", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: "test",
      });

      const result = await bgClient._send("test/action", { param: "value" });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "test/action",
        param: "value",
      });
      expect(result).toEqual({ success: true, data: "test" });
    });

    test("should send message without payload", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await bgClient._send("test/action");

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: "test/action",
      });
      expect(result).toEqual({ success: true });
    });

    test("should handle response without success field", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue(null);

      const result = await bgClient._send("test/action");

      expect(result).toBeUndefined();
    });

    test("should handle response with custom error message", async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: "Custom error message",
      });

      const result = await bgClient._send("test/action");

      expect(result).toBeUndefined();
    });

    test("should handle chrome runtime exceptions", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      chromeMock.runtime.sendMessage.mockRejectedValue(
        new Error("Connection error")
      );

      const result = await bgClient._send("test/action");

      expect(result).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Background message failed:",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
