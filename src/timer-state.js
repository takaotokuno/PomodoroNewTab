/**
 * TimerState class to manage the state of a Pomodoro timer.
 * Handles starting, pausing, resuming, resetting, and updating the timer.
 */
import Constants from "./constants.js";
const { TIMER_MODES, SESSION_TYPES, DURATIONS } = Constants;

export default class TimerState {
  constructor() {
    this.reset();
  }

  /**
   * Starts the timer with a total duration in minutes.
   * @param {number} totalDurationMinutes - Total duration in minutes (default 60).
   */
  start(totalDurationMinutes = DURATIONS.DEFAULT_TOTAL_MINUTES) {
    this.reset();

    this.mode = TIMER_MODES.RUNNING;

    this.totalStartTime = Date.now();
    this.totalDuration = totalDurationMinutes * 60 * 1000; // convert minutes to ms

    this.sessionStartTime = Date.now();
    this.sessionDuration = Math.min(DURATIONS.WORK_SESSION, this.totalDuration);
  }

  /**
   * Pauses the timer.
   */
  pause() {
    if (this.mode !== TIMER_MODES.RUNNING) return;

    this._updateElapsed();

    this.mode = TIMER_MODES.PAUSED;
    this.pausedAt = Date.now();
  }

  /**
   * Resumes the timer.
   */
  resume() {
    if (this.mode !== TIMER_MODES.PAUSED) return;

    const pauseDuration = Date.now() - this.pausedAt;

    this.totalStartTime += pauseDuration;
    this.sessionStartTime += pauseDuration;

    this.mode = TIMER_MODES.RUNNING;
    this.pausedAt = null;
  }

  /**
   * Resets the timer to its initial state.
   */
  reset() {
    this.mode = TIMER_MODES.SETUP;
    this.totalStartTime = null;
    this.totalDuration = null;
    this.totalElapsed = 0;
    this.sessionType = SESSION_TYPES.WORK;
    this.sessionStartTime = null;
    this.sessionDuration = DURATIONS.WORK_SESSION;
    this.sessionElapsed = 0;
    this.pausedAt = null;
  }

  /**
   * Updates the timer state, should be called periodically (e.g., every second).
   */
  update() {
    if (this.mode !== TIMER_MODES.RUNNING) return;

    this._updateElapsed();

    if (this._isTotalComplete()) {
      this.mode = TIMER_MODES.COMPLETED;
      return this;
    }

    if (this._isSessionComplete()) {
      this._switchSession();
      return { ...this, isSessionComplete: true };
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

    if (this.sessionElapsed != null) {
      this.sessionElapsed = now - this.sessionStartTime;
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
    return this.sessionElapsed >= this.sessionDuration;
  }

  /**
   * Switches between work and break sessions.
   * @private
   */
  _switchSession() {
    const isWorking = this.sessionType === SESSION_TYPES.WORK;

    this.sessionType = isWorking ? SESSION_TYPES.BREAK : SESSION_TYPES.WORK;
    this.sessionDuration = isWorking
      ? DURATIONS.BREAK_SESSION
      : DURATIONS.WORK_SESSION;
    this.sessionDuration = Math.min(
      this.sessionDuration,
      this.getTotalRemaining()
    );
    this.sessionStartTime = Date.now();
    this.sessionElapsed = 0;
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
  getSessionRemaining() {
    return Math.max(0, this.sessionDuration - this.sessionElapsed);
  }

  /**
   * Create a serializable snapshot of the current timer state.
   * Note: elapsed fields are intentionally omitted and will be recomputed.
   * from wall-clock time on restore.
   * @returns {object}
   */
  toSnapshot() {
    return {
      mode: this.mode,
      totalStartTime: this.totalStartTime,
      totalDuration: this.totalDuration,
      sessionType: this.sessionType,
      sessionStartTime: this.sessionStartTime,
      sessionDuration: this.sessionDuration,
      pausedAt: this.pausedAt,
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
    if (!snap) return t;

    t.mode = snap.mode || TIMER_MODES.SETUP;
    t.totalStartTime = snap.totalStartTime ?? null;
    t.totalDuration =
      snap.totalDuration ?? DURATIONS.DEFAULT_TOTAL_MINUTES * 60 * 1000;
    t.sessionType = snap.sessionType ?? SESSION_TYPES.WORK;
    t.sessionStartTime = snap.sessionStartTime ?? null;
    t.sessionDuration = snap.sessionDuration ?? DURATIONS.WORK_SESSION;
    t.pausedAt = snap.pausedAt ?? null;

    // Recompute elapsed fields based on wall-clock time
    t.totalElapsed = Date.now() - t.totalStartTime;
    t.sessionElapsed = Date.now() - t.sessionStartTime;

    t.update();
    return t;
  }
}
