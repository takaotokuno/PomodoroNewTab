/**
 * Event handling guidelines:
 * - Keep lifecycle entry points in index (onInstalled, onStartup, onSuspend)
 * - Keep cross-cutting hubs in index (onMessage as a router)
 * - Move domain-specific events into setup modules (alarms, tabs, notifications, etc.)
 * → Index = thin entry & routing hub, modules = grouped by domain responsibility
 */

import { initTimer, saveSnapshot } from "./timer-store.js";
import { setupAlarms } from "./setup-alarms.js";
import { routes } from "./events.js";

/**
 * Synchronizes timer state across all open Pomodoro timer tabs by reloading them.
 * This ensures that all tabs display the current timer state after any operation.
 */
async function syncOtherTabs() {
  try {
    // Query for all tabs that match the Pomodoro timer URL pattern
    const pomodoroTabs = await chrome.tabs.query({
      url: chrome.runtime.getURL('src/ui/ui.html*')
    });

    // Reload each tab to sync the timer state
    for (const tab of pomodoroTabs) {
      try {
        await chrome.tabs.reload(tab.id);
      } catch (error) {
        // Ignore errors for tabs that may have been closed
        console.warn(`Failed to reload tab ${tab.id}:`, error);
      }
    }
  } catch (error) {
    console.warn('Failed to sync tabs:', error);
  }
}

// Ensure timer is restored on extension install and browser startup
chrome.runtime.onInstalled.addListener(initTimer);
chrome.runtime.onStartup.addListener(initTimer);

setupAlarms();

/**
 * Global message handler for extension runtime.
 * Uses routes table to dispatch logic based on msg.type.
 * After each timer operation, synchronizes state across all open tabs.
 */
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    try {
      const fn = routes[msg?.type];
      if (!fn) return sendResponse({ ok: false, error: "unknown route" });
      await initTimer();
      const data = await fn(msg);
      await saveSnapshot();

      // Synchronize timer state across all open Pomodoro tabs
      await syncOtherTabs();

      sendResponse({ success: true, ...data });
    } catch (e) {
      sendResponse({ success: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
