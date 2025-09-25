/**
 * Show a Chrome desktop notification.
 * @param {object} param0 - Notification options
 * @param {string} param0.id - Notification ID
 * @param {string} param0.title - Notification title
 * @param {string} param0.message - Notification body
 */
export async function notify({ id, title, message }) {
  return chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2,
  });
}
