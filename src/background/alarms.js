import { initTimer, getTimer, saveSnapshot } from "./timer-store.js";
import { handleUpdateResult } from "./events.js";

const TICK = "POMODORO_TICK";

export function setupAlarms() {
  // Create a repeating alarm every 1 minute to keep Service Worker alive and update timer state
  chrome.alarms.create(TICK, { periodInMinutes: 1 });

  /**
   * Handle alarms. Every minute we update the timer,
   * process events (completion/session switch), and persist snapshot.
   */
  chrome.alarms.onAlarm.addListener(async (a) => {
    if (a.name !== TICK) return;
    await initTimer();
    const timer = getTimer();
    const res = timer.update();
    await handleUpdateResult(timer, res);
    await saveSnapshot();
  });
}
