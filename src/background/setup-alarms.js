import { getTimer, saveSnapshot } from "./timer-store.js";
import { handleEvents } from "./events.js";

const TICK = "POMODORO_TICK";
let isInitialized = false;

export function setupAlarms() {
  if (isInitialized) return;
  isInitialized = true;

  /**
   * Handle alarms. Every minute we update the timer,
   * process events (completion/session switch), and persist snapshot.
   */
  chrome.alarms.onAlarm.addListener(async (a) => {
    if (a.name !== TICK) return;

    const timer = getTimer();
    if (!timer) return;
    const res = timer.update();

    await handleEvents(res);
    await saveSnapshot();
  });
}

export function startTick() {
  // Create a repeating alarm every 1 minute to keep Service Worker alive and update timer state
  chrome.alarms.create(TICK, { periodInMinutes: 1 });
}

export function stopTick() {
  chrome.alarms.clear(TICK);
}
