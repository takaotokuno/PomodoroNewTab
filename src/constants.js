/**
 * Constants and configuration values
 */

export default class Constants {
  static DURATIONS = {
    WORK_SESSION: 25 * 60 * 1000, // 25 minutes
    BREAK_SESSION: 5 * 60 * 1000, // 5 minutes
    DEFAULT_TOTAL_MINUTES: 60,
    MIN_TOTAL_MINUTES: 15,
    MAX_TOTAL_MINUTES: 300,
  };

  static TIMER_MODES = {
    SETUP: "setup",
    RUNNING: "running",
    PAUSED: "paused",
    COMPLETED: "completed",
  };

  static SESSION_TYPES = {
    WORK: "work",
    BREAK: "break",
  };
}
