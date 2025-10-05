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

  const tabs = await chrome.tabs.query({ url: query });
  const activeTab = await _getActiveTab();

  for (const t of tabs) {
    try {
      if (_isActiveTab(t, activeTab)) {
        // active tab: reload and display a block page
        await chrome.tabs.reload(t.id);
      } else {
        // inactive tab: close tab
        await chrome.tabs.remove(t.id);
      }
    } catch {
      /* nothing */
    }
  }
}

/**
 * Get the currently active tab
 * @returns {Promise<chrome.tabs.Tab|null>} The active tab, or null if not found
 */
async function _getActiveTab() {
  try {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTabs.length > 0 ? activeTabs[0] : null;
  } catch (error) {
    console.warn('Failed to get active tab:', error);
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
