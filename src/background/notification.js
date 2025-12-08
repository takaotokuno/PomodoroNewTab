/**
 * Show a Chrome desktop notification.
 * @param {object} param0 - Notification options
 * @param {string} param0.id - Notification ID
 * @param {string} param0.title - Notification title
 * @param {string} param0.message - Notification body
 * @returns {Promise<Object>} Result object with success status
 */

export async function notify({ id, title, message }) {
  try {
    const iconUrl = chrome.runtime.getURL("resources/icon.png");

    console.log("Showing notification:", title, message);
    await chrome.notifications.create(id, {
      type: "basic",
      iconUrl,
      title,
      message,
      priority: 2,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to show notification: ${error.message}`,
    };
  }
}
