import { z } from "zod";
import { initTimer, getTimer, saveSnapshot } from "./timer-store.js";
import { startTick, stopTick } from "./setup-alarms.js";
import { notify } from "./notification.js";
import { enableBlock, disableBlock } from "./sites-guard.js";
import { handleSound } from "./sound-controller.js";
import { createErrObject, normalizeResponse, isFatal } from "./result.js";
import Constants from "../constants.js";

const SoundSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  soundVolume: z.number().min(0).max(100),
});

/**
 * Configuration for sub-module operations.
 * Defines error handling strategy (fatal vs warning) for each operation type.
 */
const OPERATIONS = {
  initTimer: { fn: initTimer, fatal: true },
  saveSnapshot: { fn: saveSnapshot, fatal: false },
  handleSound: { fn: handleSound, fatal: false },
  enableBlock: { fn: enableBlock, fatal: true },
  disableBlock: { fn: disableBlock, fatal: true },
  startTick: { fn: startTick, fatal: true },
  stopTick: { fn: stopTick, fatal: true },
  notify: { fn: notify, fatal: false },
};

/**
 * Creates a step object for an operation defined in OPERATIONS config.
 * @param {string} operationName - Name of the operation in OPERATIONS
 * @param {...any} args - Arguments to pass to the operation function
 * @returns {Object} Step object with fn, name, and fatal properties
 */
function _onStep(operationName, ...args) {
  const operation = OPERATIONS[operationName];
  if (!operation) {
    throw new Error(`Unknown operation: ${operationName}`);
  }
  return {
    fn: async () => operation.fn(...args),
    name: operationName,
    fatal: operation.fatal,
  };
}

/**
 * Main event handler that orchestrates timer initialization, event execution,
 * sound handling, and state persistence.
 * @param {string} type - Event type (e.g., "timer/start", "timer/pause")
 * @param {Object} payload - Event payload data
 * @returns {Promise<Object>} Result object with success status and any errors
 */
export async function handleEvents(type, payload = {}) {
  const eventBuilder = EVENTS[type];
  if (!eventBuilder) {
    return createErrObject(new Error(`Unknown event type: ${type}`), true);
  }

  // Initialize timer first before getting it
  const initRes = await _runStep(_onStep("initTimer"));
  if (isFatal(initRes)) return initRes;

  // Now safe to call eventBuilder which may use getTimer()
  const mainRes = await eventBuilder(payload);
  if (isFatal(mainRes)) return mainRes;

  const postSteps = [_onStep("handleSound"), _onStep("saveSnapshot")];
  const postRes = await _runSteps(postSteps);
  if (isFatal(postRes)) return postRes;

  return _mergeResults(initRes, mainRes, postRes);
}

/**
 * Executes a series of steps sequentially, handling errors according to each step's configuration.
 * Returns immediately if a fatal error occurs.
 * @param {Array<Object>} steps - Array of step objects
 * @returns {Promise<Object>} Merged result of all steps
 */
async function _runSteps(steps) {
  const results = [];

  for (const step of steps) {
    const res = await _runStep(step);
    if (isFatal(res)) return res;
    results.push(res);
  }

  return _mergeResults(...results);
}

/**
 * Executes a single step with error handling.
 * @param {Object} step - Step object with fn, name, and fatal properties
 * @returns {Promise<Object>} Normalized result object
 */
async function _runStep(step) {
  try {
    const res = await step.fn();
    return normalizeResponse(res);
  } catch (e) {
    return createErrObject(e, step.fatal);
  }
}

/**
 * Creates a step for starting the timer with validation.
 * @param {number} minutes - Timer duration in minutes
 * @returns {Object} Step object
 */
function _startTimerStep(minutes) {
  return {
    fn: () => {
      if (minutes === undefined || minutes === null) {
        throw new Error("Invalid minutes: parameter is required");
      }
      if (typeof minutes !== "number" || isNaN(minutes)) {
        throw new Error("Invalid minutes: must be a number");
      }
      if (minutes < Constants.DURATIONS.MIN_TOTAL_MINUTES) {
        throw new Error(
          `Invalid minutes: must be at least ${Constants.DURATIONS.MIN_TOTAL_MINUTES}`
        );
      }
      if (minutes > Constants.DURATIONS.MAX_TOTAL_MINUTES) {
        throw new Error(
          `Invalid minutes: must be at most ${Constants.DURATIONS.MAX_TOTAL_MINUTES}`
        );
      }
      getTimer().start(minutes);
      return { success: true };
    },
    name: "startTimer",
    fatal: true,
  };
}

/**
 * Creates a step for saving sound settings.
 * @param {boolean} isEnabled - Whether sound is enabled
 * @returns {Object} Step object
 */
function _saveSoundStep(payload) {
  return {
    fn: () => {
      const result = SoundSettingsSchema.safeParse(payload);
      if (!result.success) {
        const errorMessages =
          result.error?.issues?.map((issue) => issue.message).join(", ") ||
          "Validation failed";
        throw new Error(errorMessages);
      }

      const { soundEnabled, soundVolume } = result.data;
      getTimer().soundEnabled = soundEnabled;
      getTimer().soundVolume = soundVolume;
      return result.data;
    },
    name: "saveSound",
    fatal: true,
  };
}

/**
 * Events for handling messages from UI/content scripts.
 * Each event is defined as a function that returns a result or executes steps.
 */
const EVENTS = {
  "timer/start": async (payload) => {
    const { minutes } = payload;
    const steps = [
      _startTimerStep(minutes),
      _onStep("enableBlock"),
      _onStep("startTick"),
    ];
    return await _runSteps(steps);
  },
  "timer/pause": async () => {
    getTimer().pause();
    return await _runSteps([_onStep("stopTick")]);
  },
  "timer/resume": async () => {
    getTimer().resume();
    return await _runSteps([_onStep("startTick")]);
  },
  "timer/reset": async () => {
    getTimer().reset();
    const steps = [_onStep("disableBlock"), _onStep("stopTick")];
    return await _runSteps(steps);
  },
  "timer/update": async () => {
    const timer = getTimer();
    const res = timer.update();
    const switchRes = await _handleSwitch(res);
    return {
      ...switchRes,
      mode: timer.mode,
      totalRemaining: timer.getTotalRemaining(),
      sessionType: timer.sessionType,
      sessionRemaining: timer.getSessionRemaining(),
      soundEnabled: timer.soundEnabled,
      soundVolume: timer.soundVolume,
    };
  },
  "sound/save": async (payload) => {
    const step = _saveSoundStep(payload);
    return await _runStep(step);
  },
};

/**
 * Handle events returned by TimerState.update().
 * - No-op if timer is inactive/paused.
 * - Show "complete" notification when total finishes.
 * - Show "switch" notification when a session ends,
 *   using currentSessionType after the switch.
 */
async function _handleSwitch(res) {
  if (!res) return { success: true };

  const steps = [];

  if (res.mode === Constants.TIMER_MODES.COMPLETED) {
    const notification = {
      id: "complete" + Date.now(),
      title: "ポモドーロ完了",
      message: "お疲れ様！また頑張ろう",
    };

    steps.push(
      _onStep("notify", notification),
      _onStep("disableBlock"),
      _onStep("stopTick")
    );
  } else if (res.isSessionComplete) {
    const isWork = res.sessionType === Constants.SESSION_TYPES.WORK;
    const notification = {
      id: "switch" + Date.now(),
      title: isWork ? "作業開始！" : "休憩開始",
      message: isWork
        ? "SNSをブロックしたよ。作業に集中しよう"
        : "ブロックを解除したよ。肩の力を抜こう",
    };

    steps.push(
      _onStep("notify", notification),
      isWork ? _onStep("enableBlock") : _onStep("disableBlock")
    );
  }

  return await _runSteps(steps);
}

/**
 * Merges multiple operation results, prioritizing fatal errors over warnings.
 * @param {...Object} results - Result objects to merge
 * @returns {Object} Merged result with aggregated warnings or fatal error
 */
function _mergeResults(...results) {
  const validResults = results.filter((r) => r !== undefined && r !== null);

  const fatal = validResults.find(isFatal);
  if (fatal) return fatal;

  const warnings = validResults.filter((r) => r?.success === false);
  const merged = Object.assign({}, ...validResults);

  if (warnings.length > 0) {
    return {
      ...merged,
      success: false,
      severity: Constants.SEVERITY_LEVELS.WARNING,
      error: warnings.map((w) => w.error).join("\n"),
    };
  }

  return { success: true, ...merged };
}
