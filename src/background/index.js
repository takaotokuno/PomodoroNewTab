/**
 * Event handling guidelines:
 * - Keep lifecycle entry points in index (onInstalled, onStartup, onSuspend)
 * - Keep cross-cutting hubs in index (onMessage as a router)
 * - Move domain-specific events into setup modules (alarms, tabs, notifications, etc.)
 * → Index = thin entry & routing hub, modules = grouped by domain responsibility
 */

import { initTimer } from "./timer-store.js";
import { setupAlarms } from "./setup-alarms.js";
import { setupSound } from "./sound-controller.js";
import { handleEvents } from "./events.js";

// Ensure timer is restored on extension install and browser startup
chrome.runtime.onInstalled.addListener(initTimer);
chrome.runtime.onStartup.addListener(initTimer);

setupAlarms();

setupSound();

/**
 * Global message handler for extension runtime.
 * Uses events table to dispatch logic based on msg.type.
 */
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    try {
      let data = await handleEvents(msg.type, msg);
      sendResponse(data);

    } catch (e) {
      sendResponse({
        success: false,
        severity: "fatal",
        error: String(e?.message || e),
      });
    }
  })();
  return true;
});
