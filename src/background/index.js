/**
 * Event handling guidelines:
 * - Keep lifecycle entry points in index (onInstalled, onStartup, onSuspend)
 * - Keep cross-cutting hubs in index (onMessage as a router)
 * - Move domain-specific events into setup modules (alarms, tabs, notifications, etc.)
 * → Index = thin entry & routing hub, modules = grouped by domain responsibility
 */

import { initTimer, saveSnapshot } from "./timer-store.js";
import { setupAlarms } from "./alarms.js";
import { routes } from "./events.js";

// Ensure timer is restored on extension install and browser startup
chrome.runtime.onInstalled.addListener(initTimer);
chrome.runtime.onStartup.addListener(initTimer);

setupAlarms();

/**
 * Global message handler for extension runtime.
 * Uses routes table to dispatch logic based on msg.type.
 */
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    try {
      const fn = routes[msg?.type];
      if (!fn) return sendResponse({ ok: false, error: "unknown route" });
      await initTimer();
      const data = await fn(msg);
      await saveSnapshot();
      sendResponse({ success: true, ...data });
    } catch (e) {
      sendResponse({ success: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
