/**
 * TimerState class to manage the state of a Pomodoro timer.
 * Handles starting, pausing, resuming, resetting, and updating the timer.
 */
import Constants from "./constants.js";

export default class TimerState {
  constructor() {
    this.reset();
  }

  /**
   * Starts the timer with a total duration in minutes.
   * @param {number} totalDurationMinutes - Total duration in minutes (default 60).
   */
  start(totalDurationMinutes = Constants.DURATIONS.DEFAULT_TOTAL_MINUTES) {
    this.reset();

    this.isActive = true;
    this.totalStartTime = Date.now();
    this.currentSessionStartTime = Date.now();
    this.totalDuration = totalDurationMinutes * 60 * 1000; // convert minutes to ms
  }

  /**
   * Pauses the timer.
   */
  pause() {
    if (!this.isActive || this.isPaused) return;

    this._updateElapsed();

    this.isPaused = true;
    this.pausedAt = Date.now();
  }

  /**
   * Resumes the timer.
   */
  resume() {
    if (!this.isActive || !this.isPaused) return;

    const pauseDuration = Date.now() - this.pausedAt;

    this.totalStartTime += pauseDuration;
    this.currentSessionStartTime += pauseDuration;

    this.isPaused = false;
    this.pausedAt = null;
  }

  /**
   * Resets the timer to its initial state.
   */
  reset() {
    this.isActive = false;
    this.isPaused = false;
    this.totalStartTime = null;
    this.totalDuration = null;
    this.totalElapsed = 0;
    this.currentSessionType = Constants.SESSION_TYPES.WORK;
    this.currentSessionStartTime = null;
    this.currentSessionDuration = Constants.DURATIONS.WORK_SESSION;
    this.currentSessionElapsed = 0;
    this.pausedAt = null;
  }

  /**
   * Updates the timer state, should be called periodically (e.g., every second).
   */
  update() {
    if (!this.isActive || this.isPaused) return;

    this._updateElapsed();

    if (this._isTotalComplete()) {
      this.isActive = false;
      return { isTotalComplete: true };
    }

    if (this._isSessionComplete()) {
      this._switchSession();
      return { isSessionComplete: true };
    }
  }

  /**
   * Updates elapsed time for total and current session.
   * @private
   */
  _updateElapsed() {
    const now = Date.now();

    if (this.totalStartTime != null) {
      this.totalElapsed = now - this.totalStartTime;
    }

    if (this.currentSessionElapsed != null) {
      this.currentSessionElapsed = now - this.currentSessionStartTime;
    }
  }

  /**
   * Checks if the total duration is complete.
   * @private
   * @returns {boolean} - True if total duration is complete.
   */
  _isTotalComplete() {
    return this.totalElapsed >= this.totalDuration;
  }

  /**
   * Checks if the current session is complete.
   * @private
   * @returns {boolean} - True if current session is complete.
   */
  _isSessionComplete() {
    return this.currentSessionElapsed >= this.currentSessionDuration;
  }

  /**
   * Switches between work and break sessions.
   * @private
   */
  _switchSession() {
    const isWorking = this.currentSessionType === Constants.SESSION_TYPES.WORK;

    this.currentSessionType = isWorking
      ? Constants.SESSION_TYPES.BREAK
      : Constants.SESSION_TYPES.WORK;
    this.currentSessionDuration = isWorking
      ? Constants.DURATIONS.BREAK_SESSION
      : Constants.DURATIONS.WORK_SESSION;
    this.currentSessionStartTime = Date.now();
    this.currentSessionElapsed = 0;
  }

  /**
   * Returns the total remaining time in milliseconds.
   * @returns {number} - Total remaining time in ms.
   */
  getTotalRemaining() {
    return Math.max(0, this.totalDuration - this.totalElapsed);
  }

  /**
   * Returns the current session remaining time in milliseconds.
   * @returns {number} - Current session remaining time in ms.
   */
  getCurrentSessionRemaining() {
    return Math.max(
      0,
      this.currentSessionDuration - this.currentSessionElapsed
    );
  }

  /**
   * Create a serializable snapshot of the current timer state.
   * Note: elapsed fields are intentionally omitted and will be recomputed.
   * from wall-clock time on restore.
   * @returns {object}
   */
  toSnapshot() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      totalStartTime: this.totalStartTime,
      totalDuration: this.totalDuration,
      currentSessionType: this.currentSessionType,
      currentSessionStartTime: this.currentSessionStartTime,
      currentSessionDuration: this.currentSessionDuration,
    };
  }

  /**
   * Rebuild a TimerState instance from a previously saved snapshot.
   * This method reconstructs timestamps and durations, then performs
   * a single update to normalize derived fields (elapsed values).
   * @param {object} snap - Snapshot previously created by toSnapshot().
   * @returns {TimerState}
   */
  static fromSnapshot(snap) {
    const t = new TimerState();
    if (!snap || !snap.isActive) return t;

    t.isActive = !!snap.isActive;
    t.isPaused = !!snap.isPaused;
    t.totalStartTime = snap.totalStartTime ?? null;
    t.totalDuration = snap.totalDuration ?? null;
    t.currentSessionType =
      snap.currentSessionType ?? Constants.SESSION_TYPES.WORK;
    t.currentSessionStartTime = snap.currentSessionStartTime ?? null;
    t.currentSessionDuration =
      snap.currentSessionDuration ?? Constants.DURATIONS.WORK_SESSION;

    t.update();
    return t;
  }
}
