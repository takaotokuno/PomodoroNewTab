/**
 * Show a Chrome desktop notification.
 * @param {object} param0 - Notification options
 * @param {string} param0.id - Notification ID
 * @param {string} param0.title - Notification title
 * @param {string} param0.message - Notification body
 */

const iconUrl = chrome.runtime.getURL("resources/icon.png");

export async function notify({ id, title, message }) {
  console.log("Showing notification:", title, message);
  return chrome.notifications.create(id, {
    type: "basic",
    iconUrl,
    title,
    message,
    priority: 2,
  });
}
