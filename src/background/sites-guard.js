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
  for (const t of tabs) {
    try {
      await chrome.tabs.reload(t.id);
    } catch {
      /* nothing */
    }
  }
}
