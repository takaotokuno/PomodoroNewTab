/**
 * Unit tests for notification.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";

describe("Notification", () => {
  let chromeMock = setupChromeMock();
  let notify;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset chrome mocks to default behavior
    chromeMock.runtime.getURL.mockReturnValue(
      "chrome-extension://test/resources/icon.png"
    );
    chromeMock.notifications.create.mockResolvedValue("mock-notification-id");

    // Import fresh modules after reset
    const notificationModule = await import("@/background/notification.js");
    notify = notificationModule.notify;
  });

  describe("notify()", () => {
    const mockPayload = {
      id: "test-id",
      title: "Test Title",
      message: "Test Message",
    };

    test("should call chrome.notifications.create with correct parameters", async () => {
      const mockIconUrl = "chrome-extension://test/resources/icon.png";
      chromeMock.runtime.getURL.mockReturnValue(mockIconUrl);

      await notify(mockPayload);

      expect(chromeMock.runtime.getURL).toHaveBeenCalledWith(
        "resources/icon.png"
      );
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        mockPayload.id,
        {
          type: "basic",
          iconUrl: mockIconUrl,
          title: mockPayload.title,
          message: mockPayload.message,
          priority: 2,
        }
      );
    });

    test("should return the result from chrome.notifications.create", async () => {
      const mockNotificationId = "created-notification-id";
      chromeMock.notifications.create.mockResolvedValue(mockNotificationId);

      const result = await notify(mockPayload);

      expect(result).toBe(mockNotificationId);
    });

    test("should handle chrome.runtime.getURL errors", async () => {
      chromeMock.runtime.getURL.mockImplementationOnce(() => {
        throw new Error("Runtime getURL error");
      });

      await expect(notify(mockPayload)).rejects.toThrow("Runtime getURL error");
    });

    test("should handle chrome.notifications.create errors", async () => {
      chromeMock.notifications.create.mockRejectedValueOnce(
        new Error("Notification creation failed")
      );

      await expect(notify(mockPayload)).rejects.toThrow(
        "Notification creation failed"
      );
    });

    test("should handle missing id parameter", async () => {
      const payloadWithoutId = {
        title: "Test Title",
        message: "Test Message",
      };

      await notify(payloadWithoutId);

      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          title: payloadWithoutId.title,
          message: payloadWithoutId.message,
        })
      );
    });

    test("should handle missing title parameter", async () => {
      const payloadWithoutTitle = {
        id: "test-id",
        message: "Test Message",
      };

      await notify(payloadWithoutTitle);

      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        payloadWithoutTitle.id,
        expect.objectContaining({
          title: undefined,
          message: payloadWithoutTitle.message,
        })
      );
    });

    test("should handle missing message parameter", async () => {
      const payloadWithoutMessage = {
        id: "test-id",
        title: "Test Title",
      };

      await notify(payloadWithoutMessage);

      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        payloadWithoutMessage.id,
        expect.objectContaining({
          title: payloadWithoutMessage.title,
          message: undefined,
        })
      );
    });

    test("should handle empty payload object", async () => {
      await notify({});

      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          type: "basic",
          priority: 2,
          title: undefined,
          message: undefined,
        })
      );
    });
  });
});
