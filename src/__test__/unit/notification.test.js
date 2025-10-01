/**
 * Unit tests for notification.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome";
import { notify } from "@/background/notification.js";

let notifications;
const payload = {
  id: "test-id",
  title: "Test Title",
  message: "Test Message",
};
beforeEach(() => {
  vi.resetModules();
  ({ notifications } = setupChromeMock());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("notification", () => {
  test("notify calls chrome.notifications.create with correct arguments", async () => {
    await notify(payload);
    expect(notifications.create).toHaveBeenCalledWith(
      payload.id,
      expect.objectContaining({
        title: payload.title,
        message: payload.message,
      })
    );
  });
});
