const $ = (id) => document.getElementById(id);

const els = {
  defaultList: $("default-list"),
  enabled: $("enabled"),
  skipPinned: $("skip-pinned"),
  input: $("pattern-input"),
  isRegex: $("is-regex"),
  addBtn: $("add-btn"),
  list: $("pattern-list"),
  empty: $("empty-state"),
  count: $("count"),
  sweepBtn: $("sweep-btn"),
  hint: $("hint")
};

let state = { enabled: true, skipPinned: true, patterns: [], defaultStates: {} };

async function load() {
  state = await chrome.storage.sync.get({
    enabled: true,
    skipPinned: true,
    patterns: [],
    defaultStates: {}
  });
  const { closedCount = 0 } = await chrome.storage.local.get("closedCount");
  els.enabled.checked = state.enabled;
  els.skipPinned.checked = state.skipPinned;
  els.count.textContent = closedCount;
  renderDefaults();
  render();
}

function renderDefaults() {
  els.defaultList.innerHTML = "";
  for (const p of DEFAULT_PATTERNS) {
    const li = document.createElement("li");
    li.className = "default-item";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = state.defaultStates[p.id] !== false; // enabled unless turned off
    toggle.title = "Enable or disable this built-in pattern";
    toggle.addEventListener("change", async () => {
      state.defaultStates[p.id] = toggle.checked;
      await chrome.storage.sync.set({ defaultStates: state.defaultStates });
      li.classList.toggle("off", !toggle.checked);
    });

    const text = document.createElement("div");
    text.className = "default-text";

    const label = document.createElement("span");
    label.className = "default-label";
    label.textContent = p.label;

    const code = document.createElement("code");
    code.textContent = p.value;
    code.title = p.value;

    text.append(label, code);
    li.append(toggle, text);
    li.classList.toggle("off", !toggle.checked);
    els.defaultList.appendChild(li);
  }
}

function render() {
  els.list.innerHTML = "";
  els.empty.style.display = state.patterns.length ? "none" : "block";
  state.patterns.forEach((p, i) => {
    const li = document.createElement("li");

    const badge = document.createElement("span");
    badge.className = "badge " + (p.isRegex ? "badge-re" : "badge-glob");
    badge.textContent = p.isRegex ? "re" : "glob";

    const code = document.createElement("code");
    code.textContent = p.value;
    code.title = p.value;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "\u00d7";
    del.title = "Remove pattern";
    del.addEventListener("click", async () => {
      state.patterns.splice(i, 1);
      await chrome.storage.sync.set({ patterns: state.patterns });
      render();
    });

    li.append(badge, code, del);
    els.list.appendChild(li);
  });
}

function validate(value, isRegex) {
  if (!value) return "Enter a pattern first.";
  if (isRegex) {
    try {
      new RegExp(value);
    } catch (e) {
      return "Invalid regex: " + e.message;
    }
  }
  if (state.patterns.some((p) => p.value === value && p.isRegex === isRegex)) {
    return "That pattern is already in the list.";
  }
  return null;
}

async function addPattern() {
  const value = els.input.value.trim();
  const isRegex = els.isRegex.checked;
  const error = validate(value, isRegex);
  if (error) {
    els.hint.textContent = error;
    els.hint.classList.add("error");
    return;
  }
  els.hint.classList.remove("error");
  els.hint.innerHTML = 'Patterns match the whole URL; <code>*</code> matches anything. Example: <code>*://*.reddit.com/*</code>';
  state.patterns.push({ value, isRegex });
  await chrome.storage.sync.set({ patterns: state.patterns });
  els.input.value = "";
  render();
}

els.addBtn.addEventListener("click", addPattern);
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addPattern();
});

els.enabled.addEventListener("change", () =>
  chrome.storage.sync.set({ enabled: els.enabled.checked })
);
els.skipPinned.addEventListener("change", () =>
  chrome.storage.sync.set({ skipPinned: els.skipPinned.checked })
);

els.sweepBtn.addEventListener("click", async () => {
  els.sweepBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "SWEEP_NOW" });
  els.sweepBtn.disabled = false;
  els.sweepBtn.textContent =
    res && res.closed ? `Closed ${res.closed} tab${res.closed === 1 ? "" : "s"}` : "No matching tabs open";
  setTimeout(() => (els.sweepBtn.textContent = "Sweep open tabs now"), 2000);
  const { closedCount = 0 } = await chrome.storage.local.get("closedCount");
  els.count.textContent = closedCount;
});

load();
