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
    try {
      await handleEvents("timer/update");
    } catch (e) {
      console.error("Alarm message failed:", e);
    }
  });
}

/**
 * Start the timer tick alarm
 * @throws {Error} If alarm creation fails
 */
export function startTick() {
  // Create a repeating alarm every 1 minute to keep Service Worker alive and update timer state
  chrome.alarms.create(TICK, { periodInMinutes: 1 });
}

/**
 * Stop the timer tick alarm
 * @throws {Error} If alarm clearing fails
 */
export async function stopTick() {
  await chrome.alarms.clear(TICK);
}
