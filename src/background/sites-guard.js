const RULE_ID_BASE = 10_100;
const REDIRECT_PATH = "/src/ui/ui.html";

const TARGETS = [
  "x.com",
  "twitter.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "pixiv.net",
  "nicovideo.jp",
  "syosetu.com",
  "yomou.syosetu.com",
  "read.amazon.co.jp/manga",
];

function _buildRules() {
  return TARGETS.map((domain, i) => ({
    id: RULE_ID_BASE + i,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: REDIRECT_PATH },
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"],
    },
  }));
}

function _allRuleIds() {
  return TARGETS.map((_, i) => RULE_ID_BASE + i);
}

export async function enableBlock() {
  const rules = _buildRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: [],
  });
  await _scrubOpenTabs();
}

export async function disableBlock() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: _allRuleIds(),
  });
}

async function _scrubOpenTabs() {
  const urlType1 = TARGETS.map((d) => `*://*.${d}/*`);
  const urlType2 = TARGETS.map((d) => `*://${d}/*`);
  const query = urlType1.concat(urlType2);

  // Let critical errors (like tabs.query permission issues) bubble up
  const tabs = await chrome.tabs.query({ url: query });
  const activeTab = await _getActiveTab();

  if (tabs.length === 0) {
    return; // No SNS tabs to process
  }

  // Handle individual tab operations gracefully
  const results = await Promise.allSettled(
    tabs.map(async (tab) => {
      if (_isActiveTab(tab, activeTab)) {
        // Active tab: reload to display block page
        return await _reloadTab(tab);
      } else {
        // Inactive tab: close completely
        return await _closeTab(tab);
      }
    })
  );

  // Log any failures for debugging
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.warn(
      `Failed to process ${failures.length} out of ${tabs.length} SNS tabs`
    );
  }
}

/**
 * Get the currently active tab
 * @returns {Promise<chrome.tabs.Tab|null>} The active tab, or null if not found
 */
async function _getActiveTab() {
  try {
    const activeTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return activeTabs.length > 0 ? activeTabs[0] : null;
  } catch (error) {
    console.warn("Failed to get active tab:", error);
    return null;
  }
}

/**
 * Determine if the specified tab is the active tab
 * @param {chrome.tabs.Tab} tab - The tab to check
 * @param {chrome.tabs.Tab|null} activeTab - The active tab
 * @returns {boolean} True if the tab is the active tab
 */
function _isActiveTab(tab, activeTab) {
  return activeTab && tab.id === activeTab.id;
}

/**
 * Reload a tab with proper error handling
 * @param {chrome.tabs.Tab} tab - The tab to reload
 * @returns {Promise<void>}
 */
async function _reloadTab(tab) {
  try {
    await chrome.tabs.reload(tab.id);
  } catch (error) {
    // Tab might have been closed or become invalid
    if (error.message?.includes("No tab with id")) {
      console.debug(`Tab ${tab.id} no longer exists, skipping reload`);
    } else {
      console.warn(`Failed to reload tab ${tab.id}:`, error.message);
      throw error;
    }
  }
}

/**
 * Close a tab with proper error handling
 * @param {chrome.tabs.Tab} tab - The tab to close
 * @returns {Promise<void>}
 */
async function _closeTab(tab) {
  try {
    await chrome.tabs.remove(tab.id);
  } catch (error) {
    // Tab might have already been closed
    if (error.message?.includes("No tab with id")) {
      console.debug(`Tab ${tab.id} already closed`);
    } else {
      console.warn(`Failed to close tab ${tab.id}:`, error.message);
      throw error;
    }
  }
}
