import TimerState from "../timer-state.js";

const timer = { instance: null };

/**
 * chrome.storage only supports plain objects, so we store a snapshot here.
 */
const SNAPSHOT_KEY = "pomodoroTimerSnapshot";

/**
 * Initialize the timer instance.
 * If not already initialized, restore it from snapshot storage.
 * @returns {Promise<TimerState>}
 */
export async function initTimer() {
  if (!timer.instance) {
    await _restoreSnapshot();
  }
  return timer.instance;
}

export function getTimer() {
  if (!timer.instance) throw new Error("Timer not initialized");
  return timer.instance;
}

/**
 * Save the current timer state snapshot into chrome.storage.
 * Does nothing if the instance is missing or invalid.
 * @throws {Error} If saving to storage fails
 */
export async function saveSnapshot() {
  console.log("Saving timer state snapshot");
  if (!timer.instance) return;
  await chrome.storage.local.set({
    [SNAPSHOT_KEY]: timer.instance.toSnapshot(),
  });
}

/**
 * Restore timer state from snapshot in chrome.storage.
 * If no snapshot is available, create a new TimerState.
 * @private
 */
async function _restoreSnapshot() {
  const { [SNAPSHOT_KEY]: snap } = await chrome.storage.local.get(SNAPSHOT_KEY);
  timer.instance = snap ? TimerState.fromSnapshot(snap) : new TimerState();
}
