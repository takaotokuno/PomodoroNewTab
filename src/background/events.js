import { initTimer, getTimer, saveSnapshot } from "./timer-store.js";
import { startTick, stopTick } from "./setup-alarms.js";
import { notify } from "./notification.js";
import { enableBlock, disableBlock } from "./sites-guard.js";
import { handleSound } from "./sound-controller.js";
import { alertError, fatalError, normalizeResponse, isFatal } from "./result.js";
import Constants from "../constants.js";

/**
 * Main event handler that orchestrates timer initialization, event execution,
 * sound handling, and state persistence.
 * @param {string} type - Event type (e.g., "timer/start", "timer/pause")
 * @param {Object} payload - Event payload data
 * @returns {Promise<Object>} Result object with success status and any errors
 */
export async function handleEvents(type, payload = {}) {
  const fn = events[type];
  if (!fn) {
    return fatalError(new Error(`Unknown event type: ${type}`));
  }

  const initRes = await _safeStep(() => initTimer(), { name: "initTimer", fatalOnError: true });
  if (isFatal(initRes)) return initRes;

  const timer = getTimer();
  const mainRes = normalizeResponse(await fn(payload, timer));
  if (isFatal(mainRes)) return mainRes;

  const soundRes = await _safeStep(() => handleSound(), { name: "handleSound", fatalOnError: false });
  if (isFatal(soundRes)) return soundRes;

  const saveRes = await _safeStep(() => saveSnapshot(), { name: "saveSnapshot", fatalOnError: false });
  if (isFatal(saveRes)) return saveRes;

  return _mergeResults(initRes, mainRes, soundRes, saveRes);
}

/**
 * Wraps a step function with error handling, converting exceptions to normalized results.
 * @param {Function} stepFn - Function to execute
 * @param {Object} options - Configuration options
 * @param {string} options.name - Step name for error logging
 * @param {boolean} options.fatalOnError - Whether to treat errors as fatal
 * @returns {Promise<Object>} Normalized result object
 */
async function _safeStep(stepFn, {name, fatalOnError}) {
  try {
    const res = await stepFn();
    return normalizeResponse(res);
  } catch (e) {
    return fatalOnError
      ? fatalError(e, { step: name })
      : alertError(e, { step: name });
  }
}

async function _enebleBlock() {
  return await _safeStep(() => enableBlock(), { name: "enableBlock", fatalOnError: true });
}

async function _disableBlock() {
  return await _safeStep(() => disableBlock(), { name: "disableBlock", fatalOnError: true });
}

async function _startTick() {
  return await _safeStep(() => startTick(), { name: "startTick", fatalOnError: true });
}

async function _stopTick() {
  return await _safeStep(() => stopTick(), { name: "stopTick", fatalOnError: true });
}

/**
 * Events for handling messages from UI/content scripts.
 * Each key is a message type, mapped to a function that mutates or queries TimerState.
 */
const events = {
  "timer/start": async ({ minutes }, timer) => {
    if (!minutes || minutes < 0) throw new Error("Invalid minutes");

    timer.start(minutes);
    const blockRes = await _enebleBlock();
    if (isFatal(blockRes)) return blockRes;
    
    const alarmsRes = await _startTick();
    if (isFatal(alarmsRes)) return alarmsRes;
    
    return _mergeResults(blockRes, alarmsRes);
  },
  "timer/pause": async (_, timer) => {
    timer.pause();
    const alarmsRes = await _stopTick();
    return alarmsRes;
  },
  "timer/resume": async (_, timer) => {
    timer.resume();
    const alarmsRes = await _startTick();
    return alarmsRes;
  },
  "timer/reset": async (_, timer) => {
    timer.reset();
    const blockRes = await _disableBlock();
    if (isFatal(blockRes)) return blockRes;
    const alarmsRes = await _stopTick();
    if (isFatal(alarmsRes)) return alarmsRes;
    
    return _mergeResults(blockRes, alarmsRes);
  },
  "timer/update": async (_, timer) => {
    const res = timer.update();
    const result = await _handleSwitch(res);
    return {
      ...result,
      mode: timer.mode,
      totalRemaining: timer.getTotalRemaining(),
      sessionType: timer.sessionType,
      sessionRemaining: timer.getSessionRemaining(),
      soundEnabled: timer.soundEnabled,
    };
  },
  "sound/save": async ({ isEnabled }, timer) => {
    const soundEnabled = Boolean(isEnabled);
    timer.soundEnabled = soundEnabled;
    return { soundEnabled: timer.soundEnabled };
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
  if (!res) return;

  if (res.mode === Constants.TIMER_MODES.COMPLETED) {
    const notifyRes = await _safeStep(
      () => notify({
        id: "complete" + Date.now(),
        title: "ポモドーロ完了",
        message: "お疲れ様！また頑張ろう",
      }),
      { name: "notify", fatalOnError: false }
    );

    const blockRes = await _disableBlock();
    if (isFatal(blockRes)) return blockRes;

    const alarmsRes = await _stopTick();
    if (isFatal(alarmsRes)) return alarmsRes;

    return _mergeResults(notifyRes, blockRes, alarmsRes);

  } else if (res.isSessionComplete) {
    const isWork = res.sessionType === Constants.SESSION_TYPES.WORK;
    const notifyRes = await _safeStep(
      () => notify({
        id: "switch" + Date.now(),
        title: isWork ? "作業開始！" : "休憩開始",
        message: isWork
          ? "SNSをブロックしたよ。作業に集中しよう"
          : "ブロックを解除したよ。肩の力を抜こう",
      }),
      { name: "notify", fatalOnError: false }
    );

    if (isWork) {
      const blockRes = await _enebleBlock();
      return _mergeResults(notifyRes, blockRes);
    } else {
      const blockRes = await _disableBlock();
      return _mergeResults(notifyRes, blockRes);
    }
  }
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
      warnings: warnings.map((w) => w.error),
    };
  }

  return { success: true, ...merged };
}
