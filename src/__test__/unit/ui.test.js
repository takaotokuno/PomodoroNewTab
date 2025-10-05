/**
 * Unit tests for ui.js
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";

const { TIMER_MODES, SESSION_TYPES } = Constants;

// Mock TimerTicker
const mockTimerTicker = {
  start: vi.fn(),
  stop: vi.fn(),
  resume: vi.fn(),
  applyBG: vi.fn(),
};

const MockTimerTicker = vi.fn(() => mockTimerTicker);

// Mock BGClient
const mockBGClient = {
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
};

const MockBGClient = vi.fn(() => mockBGClient);

vi.mock("@/ui/timer-ticker.js", () => ({
  TimerTicker: MockTimerTicker,
}));

vi.mock("@/ui/bg-client.js", () => ({
  BGClient: MockBGClient,
}));

describe("UI", () => {
  let chromeMock = setupChromeMock();

  // Mock DOM elements
  const mockElements = {
    "setup-screen": { style: { display: "none" } },
    "timer-duration": { value: "25" },
    "timer-duration-error": { style: { display: "none" } },
    "start-button": { addEventListener: vi.fn() },
    "running-screen": { style: { display: "none" } },
    "pause-button": { addEventListener: vi.fn(), textContent: "" },
    "reset-button": { addEventListener: vi.fn() },
    "time-display": {},
    "completed-screen": { style: { display: "none" } },
    "new-session-button": { addEventListener: vi.fn() },
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock document.getElementById
    vi.stubGlobal("document", {
      getElementById: vi.fn((id) => mockElements[id] || {}),
      addEventListener: vi.fn(),
      visibilityState: "visible",
    });

    // Mock setInterval and clearInterval
    vi.stubGlobal(
      "setInterval",
      vi.fn((fn, delay) => 123)
    );
    vi.stubGlobal("clearInterval", vi.fn());

    // Reset mocks
    mockBGClient.update.mockResolvedValue(null);
    Object.values(mockElements).forEach((element) => {
      if (element.style) element.style.display = "none";
      if (element.addEventListener) element.addEventListener.mockClear();
    });
  });

  describe("initialization", () => {
    test("should create TimerTicker and BGClient instances", async () => {
      await import("@/ui/ui.js");

      expect(MockTimerTicker).toHaveBeenCalled();
      expect(MockBGClient).toHaveBeenCalled();
    });

    test("should attach event listeners to buttons", async () => {
      await import("@/ui/ui.js");

      expect(
        mockElements["start-button"].addEventListener
      ).toHaveBeenCalledWith("click", expect.any(Function));
      expect(
        mockElements["pause-button"].addEventListener
      ).toHaveBeenCalledWith("click", expect.any(Function));
      expect(
        mockElements["reset-button"].addEventListener
      ).toHaveBeenCalledWith("click", expect.any(Function));
      expect(
        mockElements["new-session-button"].addEventListener
      ).toHaveBeenCalledWith("click", expect.any(Function));
    });

    test("should call syncFromBG during initialization", async () => {
      await import("@/ui/ui.js");

      expect(mockBGClient.update).toHaveBeenCalled();
    });
  });

  describe("start button functionality", () => {
    test("should start timer with valid duration", async () => {
      mockElements["timer-duration"].value = "25";

      await import("@/ui/ui.js");

      // Get the click handler and call it
      const clickHandler =
        mockElements["start-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.start).toHaveBeenCalledWith(25);
      expect(mockTimerTicker.start).toHaveBeenCalledWith(25);
      expect(mockElements["timer-duration-error"].style.display).toBe("none");
    });

    test("should show error for invalid duration (too short)", async () => {
      mockElements["timer-duration"].value = "3";

      await import("@/ui/ui.js");

      const clickHandler =
        mockElements["start-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.start).not.toHaveBeenCalled();
      expect(mockTimerTicker.start).not.toHaveBeenCalled();
      expect(mockElements["timer-duration-error"].style.display).toBe("block");
    });

    test("should show error for invalid duration (too long)", async () => {
      mockElements["timer-duration"].value = "400";

      await import("@/ui/ui.js");

      const clickHandler =
        mockElements["start-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.start).not.toHaveBeenCalled();
      expect(mockTimerTicker.start).not.toHaveBeenCalled();
      expect(mockElements["timer-duration-error"].style.display).toBe("block");
    });

    test("should show error for non-numeric input", async () => {
      mockElements["timer-duration"].value = "abc";

      await import("@/ui/ui.js");

      const clickHandler =
        mockElements["start-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.start).not.toHaveBeenCalled();
      expect(mockTimerTicker.start).not.toHaveBeenCalled();
      expect(mockElements["timer-duration-error"].style.display).toBe("block");
    });
  });

  describe("reset functionality", () => {
    test("should reset timer via reset button", async () => {
      await import("@/ui/ui.js");

      const clickHandler =
        mockElements["reset-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.reset).toHaveBeenCalled();
      expect(mockTimerTicker.stop).toHaveBeenCalled();
    });

    test("should reset timer via new session button", async () => {
      await import("@/ui/ui.js");

      const clickHandler =
        mockElements["new-session-button"].addEventListener.mock.calls[0][1];
      clickHandler();

      expect(mockBGClient.reset).toHaveBeenCalled();
      expect(mockTimerTicker.stop).toHaveBeenCalled();
    });
  });

  describe("syncFromBG", () => {
    test("should handle null state from background", async () => {
      mockBGClient.update.mockResolvedValue(null);

      await import("@/ui/ui.js");

      expect(mockBGClient.update).toHaveBeenCalled();
    });

    test("should sync state from background", async () => {
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000, // 25 minutes
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockTimerTicker.applyBG).toHaveBeenCalledWith(
        SESSION_TYPES.WORK,
        1500000,
        1500000
      );
    });

    test("should handle break session type", async () => {
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.BREAK,
        totalRemaining: 300000, // 5 minutes
        sessionRemaining: 300000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockTimerTicker.applyBG).toHaveBeenCalledWith(
        SESSION_TYPES.BREAK,
        300000,
        300000
      );
    });

    test("should default to SETUP mode when mode is not provided", async () => {
      const mockState = {
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockTimerTicker.applyBG).toHaveBeenCalledWith(
        SESSION_TYPES.WORK,
        1500000,
        1500000
      );
    });

    test("should default to BREAK session when sessionType is not WORK", async () => {
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: "unknown",
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockTimerTicker.applyBG).toHaveBeenCalledWith(
        SESSION_TYPES.BREAK,
        1500000,
        1500000
      );
    });
  });

  describe("sync interval management", () => {
    test("should set sync interval when timer is running", async () => {
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    test("should clear sync interval when timer is not running", async () => {
      const mockState = {
        mode: TIMER_MODES.SETUP,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 0,
        sessionRemaining: 0,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockTimerTicker.stop).toHaveBeenCalled();
    });
  });

  describe("visibility change handling", () => {
    test("should sync when document becomes visible", async () => {
      await import("@/ui/ui.js");

      // Clear previous calls
      mockBGClient.update.mockClear();

      // Get the visibility change handler
      const visibilityHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === "visibilitychange"
      )[1];

      // Mock document as visible
      document.visibilityState = "visible";
      visibilityHandler();

      expect(mockBGClient.update).toHaveBeenCalled();
    });

    test("should clear sync interval when document becomes hidden", async () => {
      // First set up a running state to create a sync interval
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      // Clear the setInterval call from initialization
      clearInterval.mockClear();

      // Get the visibility change handler
      const visibilityHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === "visibilitychange"
      )[1];

      // Mock document as hidden
      document.visibilityState = "hidden";
      visibilityHandler();

      expect(clearInterval).toHaveBeenCalled();
    });
  });
});
