// Tab Sweeper — service worker
// Closes any tab whose URL matches an enabled built-in pattern or a
// user-defined pattern.

importScripts("defaults.js");

const DEFAULTS = {
  enabled: true,
  skipPinned: true,
  patterns: [],       // user patterns: array of { value, isRegex }
  defaultStates: {}   // { [defaultPatternId]: boolean } — missing id = enabled
};

let settings = { ...DEFAULTS };
let compiled = []; // array of { re: RegExp, delayMs: number }

// ---- pattern compilation ----------------------------------------------------

// Convert a glob-style pattern to a RegExp. "*" matches any run of
// characters; everything else is literal (including ?, #, etc.).
// The pattern must match the WHOLE URL (standard glob semantics).
// For patterns shaped like scheme://host/path, a "*" in the scheme or host
// segment stays within that segment (like Chrome match patterns), so
// "https://*.zoom.us/*" cannot match a zoom.us URL embedded in another
// site's query string. Fragments like #success are matchable because
// chrome.tabs reports the full URL including the hash.
function globToRegex(glob) {
  const esc = (s, star) =>
    s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, star);

  const schemeIdx = glob.indexOf("://");
  if (schemeIdx !== -1) {
    const scheme = glob.slice(0, schemeIdx);
    const rest = glob.slice(schemeIdx + 3);
    const slash = rest.indexOf("/");
    const host = slash === -1 ? rest : rest.slice(0, slash);
    const path = slash === -1 ? "" : rest.slice(slash);
    return new RegExp(
      "^" + esc(scheme, "[^:/?#]*") + "://" + esc(host, "[^/?#]*") + esc(path, ".*") + "$",
      "i"
    );
  }
  return new RegExp("^" + esc(glob, ".*") + "$", "i");
}

function compileOne(p) {
  try {
    return {
      re: p.isRegex ? new RegExp(p.value, "i") : globToRegex(p.value),
      delayMs: p.delayMs || 0
    };
  } catch (e) {
    console.warn("Tab Sweeper: skipping invalid pattern:", p.value, e.message);
    return null;
  }
}

function isDefaultEnabled(id) {
  // Defaults are enabled unless explicitly turned off.
  return settings.defaultStates[id] !== false;
}

function compilePatterns() {
  compiled = [];
  for (const p of DEFAULT_PATTERNS) {
    if (!isDefaultEnabled(p.id)) continue;
    const c = compileOne(p);
    if (c) compiled.push(c);
  }
  for (const p of settings.patterns) {
    const c = compileOne(p);
    if (c) compiled.push(c);
  }
}

function matchUrl(url) {
  if (!url) return null;
  // Never act on browser-internal pages.
  if (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    return null;
  }
  return compiled.find((c) => c.re.test(url)) || null;
}

// ---- settings loading --------------------------------------------------------

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored };
  compilePatterns();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const key of Object.keys(changes)) {
    if (key in settings) settings[key] = changes[key].newValue;
  }
  compilePatterns();
});

// Service workers can be restarted at any time; reload settings on wake.
const ready = loadSettings();

// ---- tab watching -------------------------------------------------------------

// Minimum time to let a page settle before closing. Redirect chains (e.g.
// Cloudflare Access mid-login) briefly pass through matching URLs; closing
// instantly would kill the flow. We wait, then re-check the tab's *final* URL.
const SETTLE_MS = 1200;
const RECHECK_MS = 600;
const MAX_RECHECKS = 4;

// One pending verification per tab, so repeated onUpdated events don't stack.
const pendingChecks = new Map(); // tabId -> timeout id

function cancelPending(tabId) {
  const t = pendingChecks.get(tabId);
  if (t) {
    clearTimeout(t);
    pendingChecks.delete(tabId);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => cancelPending(tabId));

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    bumpCounter();
  } catch (e) {
    // Tab may already be gone — ignore.
  }
}

function verifyAndClose(tabId, attempt) {
  pendingChecks.delete(tabId);
  chrome.tabs.get(tabId).then((fresh) => {
    if (!settings.enabled) return;
    if (settings.skipPinned && fresh.pinned) return;

    // The tab must STILL match on its settled URL. If the match was just a
    // transient hop in a redirect chain, the URL has moved on by now.
    if (!matchUrl(fresh.url)) return;

    // Still navigating? Give the redirect chain more time before deciding,
    // up to a limit (some pages sit in "loading" forever).
    if (fresh.status !== "complete" && attempt < MAX_RECHECKS) {
      const t = setTimeout(() => verifyAndClose(tabId, attempt + 1), RECHECK_MS);
      pendingChecks.set(tabId, t);
      return;
    }

    closeTab(tabId);
  }).catch(() => {
    // Tab already closed.
  });
}

async function maybeClose(tab) {
  await ready;
  if (!settings.enabled) return;
  if (!tab || tab.id === chrome.tabs.TAB_ID_NONE) return;
  if (settings.skipPinned && tab.pinned) return;

  const url = tab.url || tab.pendingUrl;
  const match = matchUrl(url);
  if (!match) {
    // URL changed to something non-matching (e.g. redirect continued) —
    // cancel any close we had queued for this tab.
    cancelPending(tab.id);
    return;
  }

  // Reset the timer on every matching event so we always measure from the
  // most recent navigation activity.
  cancelPending(tab.id);
  const delay = Math.max(match.delayMs, SETTLE_MS);
  const t = setTimeout(() => verifyAndClose(tab.id, 0), delay);
  pendingChecks.set(tab.id, t);
}

// Fires when a tab's URL changes — including hash-only changes like #success,
// which report the full new URL in changeInfo.url.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    maybeClose(tab);
  }
});

// Fires when a tab is created (catches tabs opened with a target URL).
chrome.tabs.onCreated.addListener((tab) => maybeClose(tab));

// IMPORTANT: tabs.onUpdated does NOT fire for same-document navigations —
// hash changes (location.hash) or history.pushState/replaceState. Zoom
// appends #success exactly that way, so we need webNavigation events too.
function onSameDocNav(details) {
  if (details.frameId !== 0) return; // main frame only
  chrome.tabs
    .get(details.tabId)
    .then((tab) => maybeClose({ ...tab, url: details.url || tab.url }))
    .catch(() => {});
}
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onSameDocNav);
chrome.webNavigation.onHistoryStateUpdated.addListener(onSameDocNav);

// Safety net: when the browser starts, close any matching tabs that were
// restored from the previous session (events for them were never seen).
chrome.runtime.onStartup.addListener(async () => {
  await ready;
  if (settings.enabled) sweepAll();
});

async function sweepAll() {
  const tabs = await chrome.tabs.query({});
  const closedIds = [];
  for (const tab of tabs) {
    if (settings.skipPinned && tab.pinned) continue;
    if (matchUrl(tab.url)) closedIds.push(tab.id);
  }
  if (closedIds.length) {
    await chrome.tabs.remove(closedIds);
    const { closedCount = 0 } = await chrome.storage.local.get("closedCount");
    await chrome.storage.local.set({ closedCount: closedCount + closedIds.length });
  }
  return closedIds.length;
}

// ---- closed-tab counter (shown in the popup) -----------------------------------

async function bumpCounter() {
  const { closedCount = 0 } = await chrome.storage.local.get("closedCount");
  await chrome.storage.local.set({ closedCount: closedCount + 1 });
}

// ---- "sweep now" message from the popup -----------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SWEEP_NOW") {
    (async () => {
      await ready;
      const closed = await sweepAll();
      sendResponse({ closed });
    })();
    return true; // keep the message channel open for the async response
  }
});
