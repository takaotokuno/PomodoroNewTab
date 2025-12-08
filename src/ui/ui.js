import { TimerTicker } from "./timer-ticker.js";
import { BGClient } from "./bg-client.js";
import Constants from "../constants.js";
const { TIMER_MODES, SESSION_TYPES } = Constants;

class UIController {
  constructor() {
    this.mode = TIMER_MODES.SETUP;
    this.syncInterval = null;
    this.isProcessing = false;

    this.ticker = new TimerTicker(this);
    this.bgClient = new BGClient();

    // UI Elements
    // Setup Screen
    this.setupScreen = document.getElementById("setup-screen");
    this.timerDurationInput = document.getElementById("timer-duration");
    this.timerDurationError = document.getElementById("timer-duration-error");
    this.startButton = document.getElementById("start-button");

    // Running Screen
    this.runningScreen = document.getElementById("running-screen");
    this.pauseButton = document.getElementById("pause-button");
    this.resetButton = document.getElementById("reset-button");
    this.timeDisplay = document.getElementById("time-display");

    // Completed Screen
    this.completedScreen = document.getElementById("completed-screen");
    this.newSessionButton = document.getElementById("new-session-button");

    // Sound Setting
    this.soundToggle = document.getElementById("sound-toggle");

    this.attachEventListeners();

    this.syncFromBG();
  }

  withProcessingLock(handler) {
    return async (...args) => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await handler(...args);
      } finally {
        this.isProcessing = false;
      }
    };
  }

  attachEventListeners() {
    this.startButton.addEventListener(
      "click",
      this.withProcessingLock(async () => {
        const minutes = parseInt(this.timerDurationInput.value, 10);
        if (!isNaN(minutes) && minutes >= 5 && minutes <= 300) {
          this.bgClient.start(minutes);
          this.ticker.start(minutes);

          this.mode = TIMER_MODES.RUNNING;

          this.timerDurationError.style.display = "none";
          this.updateView();

          this.setSyncInterval();
        } else {
          this.timerDurationError.style.display = "block";
        }
      })
    );

    this.pauseButton.addEventListener(
      "click",
      this.withProcessingLock(async () => {
        if (this.mode === TIMER_MODES.RUNNING) {
          this.bgClient.pause();
          this.ticker.stop();

          this.mode = TIMER_MODES.PAUSED;

          this.clearSyncInterval();
        } else if (this.mode === TIMER_MODES.PAUSED) {
          this.bgClient.resume();
          this.ticker.resume();

          this.mode = TIMER_MODES.RUNNING;

          this.setSyncInterval();
        }
        this.updateView();
      })
    );

    this.resetButton.addEventListener(
      "click",
      this.withProcessingLock(async () => {
        await this.resetView();
      })
    );

    this.newSessionButton.addEventListener(
      "click",
      this.withProcessingLock(async () => {
        await this.resetView();
      })
    );

    this.soundToggle.addEventListener(
      "change",
      this.withProcessingLock(async () => {
        const isEnabled = this.soundToggle.checked;

        try {
          const result = await this.bgClient.saveSoundSettings(isEnabled);
          if (!result || !result.success) {
            throw new Error(result?.error || "Failed to save sound settings");
          }
        } catch (error) {
          console.error("Error saving sound settings:", error);
          // Revert checkbox on error
          this.soundToggle.checked = !isEnabled;
        }
      })
    );
  }

  async resetView() {
    await this.bgClient.reset();
    this.ticker.stop();

    this.mode = TIMER_MODES.SETUP;
    this.updateView();

    this.clearSyncInterval();
  }

  updateView() {
    this.setupScreen.style.display = "none";
    this.runningScreen.style.display = "none";
    this.completedScreen.style.display = "none";

    switch (this.mode) {
      case TIMER_MODES.SETUP:
        this.setupScreen.style.display = "block";
        break;

      case TIMER_MODES.RUNNING:
        this.runningScreen.style.display = "block";
        this.pauseButton.textContent = "Pause";
        break;

      case TIMER_MODES.PAUSED:
        this.runningScreen.style.display = "block";
        this.pauseButton.textContent = "Resume";
        break;

      case TIMER_MODES.COMPLETED:
        this.completedScreen.style.display = "block";
        break;
    }
  }

  setSyncInterval() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => this.syncFromBG(), 60000);
  }

  clearSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncFromBG() {
    const state = await this.bgClient.update();
    if (!state) return;

    this.mode = state.mode ?? TIMER_MODES.SETUP;
    const sessionType =
      state.sessionType === SESSION_TYPES.WORK
        ? SESSION_TYPES.WORK
        : SESSION_TYPES.BREAK;
    const timeTotalMs = state.totalRemaining;
    const timeSessionMs = state.sessionRemaining;

    this.ticker.applyBG(sessionType, timeTotalMs, timeSessionMs);
    if (this.mode === TIMER_MODES.RUNNING) {
      this.ticker.resume();
      this.setSyncInterval();
    } else {
      this.ticker.stop();
      this.clearSyncInterval();
    }

    const soundEnabled = state.soundEnabled ?? false;
    if (this.soundToggle.checked !== soundEnabled) {
      this.soundToggle.checked = soundEnabled;
    }

    this.updateView();
  }
}

const uiController = new UIController();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Sync immediately when tab becomes visible
    uiController.syncFromBG();
  } else {
    uiController.clearSyncInterval();
  }
});
