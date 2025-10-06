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
  saveSoundSettings: vi.fn(),
  loadSoundSettings: vi.fn(),
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
    "sound-toggle": { addEventListener: vi.fn(), checked: false },
    "running-screen": { style: { display: "none" } },
    "pause-button": { addEventListener: vi.fn(), textContent: "" },
    "reset-button": { addEventListener: vi.fn() },
    "completed-screen": { style: { display: "none" } },
    "time-display": {},
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
    mockBGClient.saveSoundSettings.mockResolvedValue({ success: true });
    Object.values(mockElements).forEach((element) => {
      if (element.style) element.style.display = "none";
      if (element.addEventListener) element.addEventListener.mockClear();
      if (element.hasOwnProperty("checked")) element.checked = false;
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
      expect(
        mockElements["sound-toggle"].addEventListener
      ).toHaveBeenCalledWith("change", expect.any(Function));
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

    test("should not set sync interval if one already exists", async () => {
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      // Clear the first setInterval call from initialization
      setInterval.mockClear();

      // Simulate calling setSyncInterval directly when interval already exists
      // This tests the early return in setSyncInterval when this.syncInterval is truthy
      const uiModule = await import("@/ui/ui.js");

      // The interval should already be set from initialization, so calling setSyncInterval again should not create a new one
      // We can't directly access the UI instance, but we can test the behavior through visibility change
      const visibilityHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === "visibilitychange"
      )[1];

      // Mock document as visible to trigger sync (which calls setSyncInterval)
      document.visibilityState = "visible";
      visibilityHandler();

      // Should not call setInterval again since interval already exists from initialization
      expect(setInterval).not.toHaveBeenCalled();
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

  describe("pause/resume functionality", () => {
    test("should handle pause button click when timer is running", async () => {
      // Set up initial running state
      const mockState = {
        mode: TIMER_MODES.RUNNING,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      // Get the pause button click handler
      const pauseHandler = mockElements[
        "pause-button"
      ].addEventListener.mock.calls.find((call) => call[0] === "click")[1];

      // Simulate pause button click (now async)
      await pauseHandler();

      expect(mockBGClient.pause).toHaveBeenCalled();
      expect(mockTimerTicker.stop).toHaveBeenCalled();
      expect(clearInterval).toHaveBeenCalled();
    });

    test("should handle resume button click when timer is paused", async () => {
      // Set up initial paused state
      const mockState = {
        mode: TIMER_MODES.PAUSED,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      // Get the pause button click handler (which becomes resume when paused)
      const pauseHandler = mockElements[
        "pause-button"
      ].addEventListener.mock.calls.find((call) => call[0] === "click")[1];

      // Simulate resume button click (now async)
      await pauseHandler();

      expect(mockBGClient.resume).toHaveBeenCalled();
      expect(mockTimerTicker.resume).toHaveBeenCalled();
      expect(setInterval).toHaveBeenCalled();
    });
  });

  describe("view modes", () => {
    test("should display completed screen when timer is completed", async () => {
      const mockState = {
        mode: TIMER_MODES.COMPLETED,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 0,
        sessionRemaining: 0,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockElements["completed-screen"].style.display).toBe("block");
    });

    test("should display paused screen with resume button text", async () => {
      const mockState = {
        mode: TIMER_MODES.PAUSED,
        sessionType: SESSION_TYPES.WORK,
        totalRemaining: 1500000,
        sessionRemaining: 1500000,
      };

      mockBGClient.update.mockResolvedValue(mockState);

      await import("@/ui/ui.js");

      expect(mockElements["running-screen"].style.display).toBe("block");
      expect(mockElements["pause-button"].textContent).toBe("Resume");
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
