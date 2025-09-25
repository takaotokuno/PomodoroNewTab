import TimerState from "./timer-state.js";
import Constants from "./constants.js";

const timer = { instance: null };

/**
 * chrome.storage only supports plain objects, so we store a snapshot here.
 */
const SNAPSHOT_KEY = "pomorodoTimerSnapshot";

/**
 * Initialize the timer instance.
 * If not already initialized, restore it from snapshot storage.
 * @returns {Promise<TimerState>}
 */
async function _initTimer() {
  if (!timer.instance) {
    await _restoreSnapshot();
  }
  return timer.instance;
}

/**
 * Save the current timer state snapshot into chrome.storage.
 * Does nothing if the instance is missing or invalid.
 */
async function _saveSnapshot() {
  if (!timer.instance?.toSnapshot) return;
  await chrome.storage.local.set({
    [SNAPSHOT_KEY]: timer.instance.toSnapshot(),
  });
}

/**
 * Restore timer state from snapshot in chrome.storage.
 * If no snapshot is available, create a new TimerState.
 */
async function _restoreSnapshot() {
  const { [SNAPSHOT_KEY]: snap } = await chrome.storage.local.get(SNAPSHOT_KEY);
  timer.instance = snap ? TimerState.fromSnapshot(snap) : new TimerState();
}

// Ensure timer is restored on extension install and browser startup
chrome.runtime.onInstalled.addListener(_initTimer);
chrome.runtime.onStartup.addListener(_initTimer);

const TICK = "POMODORO_TICK";
// Create a repeating alarm every 1 minute to keep Service Worker alive and update timer state
chrome.alarms.create(TICK, { periodInMinutes: 1 });

/**
 * Handle alarms. Every minute we update the timer,
 * process events (completion/session switch), and persist snapshot.
 */
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== TICK) return;
  await _initTimer();
  const res = timer.instance.update();
  await _handleEvents(res);
  await _saveSnapshot();
});

/**
 * Routes for handling messages from UI/content scripts.
 * Each key is a message type, mapped to a function that mutates or queries TimerState.
 */
const routes = {
  "timer/start": ({ minutes }) => timer.instance.start(minutes),
  "timer/pause": () => timer.instance.pause(),
  "timer/resume": () => timer.instance.resume(),
  "timer/reset": () => timer.instance.reset(),
  "timer/update": async () => {
    const res = timer.instance.update();
    await _handleEvents(res);
    return {
      isActive: timer.instance.isActive,
      isPaused: timer.instance.isPaused,
      totalRemaining: timer.instance.getTotalRemaining(),
      currentSessionType: timer.instance.currentSessionType,
      currentSessionRemaining: timer.instance.getCurrentSessionRemaining(),
    };
  },
};

/**
 * Global message handler for extension runtime.
 * Uses routes table to dispatch logic based on msg.type.
 */
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    try {
      const fn = routes[msg?.type];
      if (!fn) return sendResponse({ ok: false, error: "unknown route" });
      await _initTimer();
      const data = await fn(msg);
      await _saveSnapshot();
      sendResponse({ success: true, ...data });
    } catch (e) {
      sendResponse({ success: false, error: String(e?.message || e) });
    }
  })();
  return true;
});

/**
 * Handle events returned by TimerState.update().
 * - No-op if timer is inactive/paused.
 * - Show "complete" notification when total finishes.
 * - Show "switch" notification when a session ends,
 *   using currentSessionType after the switch.
 */
async function _handleEvents(res) {
  if (!res || !timer.instance) return;

  if (res.isTotalComplete) {
    await _notify({
      id: "complete",
      title: "ポモドーロ完了",
      message: "お疲れ様！また頑張ろう",
    });
    return;
  }
  if (res.isSessionComplete) {
    const isWork =
      timer.instance.currentSessionType === Constants.SESSION_TYPES.WORK;
    await _notify({
      id: "switch",
      title: isWork ? "作業開始！" : "休憩開始",
      message: isWork
        ? "SNSをブロックしたよ。作業に集中しよう"
        : "ブロックを解除したよ。肩の力を抜こう",
    });
    return;
  }
}

/**
 * Show a Chrome desktop notification.
 * @param {object} param0 - Notification options
 * @param {string} param0.id - Notification ID
 * @param {string} param0.title - Notification title
 * @param {string} param0.message - Notification body
 */
async function _notify({ id, title, message }) {
  return chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2,
  });
}
