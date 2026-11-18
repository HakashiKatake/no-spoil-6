(() => {
  const settingsApi = globalThis.NoSpoilSettings;
  const form = document.querySelector("#shield-form");
  const fields = document.querySelector("#settings-fields");
  const schedule = document.querySelector("#schedule");
  const startAt = document.querySelector("#start-at");
  const windows = document.querySelector("#windows");
  const windowTemplate = document.querySelector("#window-template");
  const addWindowButton = document.querySelector("#add-window");
  const statusCard = document.querySelector("#status-card");
  const label = document.querySelector("#status-label");
  const heading = document.querySelector("#status-heading");
  const description = document.querySelector("#status-description");
  const message = document.querySelector("#form-message");
  const activity = document.querySelector("#activity-link");
  const coverTab = document.querySelector("#cover-tab");
  const tip = document.querySelector("#reveal-tip");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.querySelector("#local-time").textContent = "Local time · " + (timezone?.replaceAll("_", " ") ?? "This device");

  let saved = settingsApi.normalize();
  let editing = false;
  let savingMode = "";
  let receivedChange = false;
  let loaded = false;
  let tabState;
  let tabId;
  let timer;

  function updateStatus() {
    const state = settingsApi.status(saved);
    const isLocked = settingsApi.locked(saved);
    let copy = {
      active: ["Shield active", "Spoilers blurred", "GTA 6 posts are covered as you browse."],
      paused: ["Shield paused", "Shield is off", "GTA 6 posts are visible while the shield is paused."],
      waiting: ["Schedule set", "Shield is waiting", "Protection starts at your scheduled local time."],
      outside: ["Schedule set", "Outside your hours", "The shield turns on during your next browsing window."]
    }[state];
    if (state === "active" && saved.scope === "story") copy[2] = "Story spoilers and leaks are covered as you browse.";
    if (state === "active" && saved.scope === "custom") copy[2] = "Your custom phrases decide which posts get covered.";
    if (state === "active" && tabState && saved.disabledSites.includes(tabState.platform)) {
      copy = ["Site excluded", "Shield is off here", "This website is excluded from post filtering."];
    }
    if (tabState?.blocked && state !== "paused") copy = ["Site block active", "Page covered", "This page matches one of your site blocks."];
    if (isLocked) copy[0] = "Shield locked";
    statusCard.dataset.state = state;
    [label.textContent, heading.textContent, description.textContent] = copy;
    fields.disabled = !loaded || isLocked;
    coverTab.hidden = !tabState?.active || isLocked || state !== "active";
    tip.textContent = isLocked ? "Manage early unlock in Settings."
      : saved.peekSeconds ? "Revealed posts re-cover in " + saved.peekSeconds + "s." : "Use the eye to reveal or cover a post.";
    clearTimeout(timer);
    const minute = 60000 - Date.now() % 60000 + 20;
    timer = setTimeout(() => {
      updateStatus();
      updateTab();
      updateActivity().catch(() => {});
    }, isLocked ? Math.min(minute, saved.lockUntil - Date.now() + 20) : minute);
  }

  async function updateTab() {
    try {
      const [tab] = await settingsApi.api.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
      tabState = Number.isInteger(tabId) ? await settingsApi.api.tabs.sendMessage(tabId, { ns6: "tab-state" }, { frameId: 0 }) : undefined;
    } catch {
      tabState = undefined;
    }
    if (loaded) updateStatus();
  }

  async function updateActivity() {
    const days = (await settingsApi.storage.local.get(settingsApi.activityKey))[settingsApi.activityKey] ?? {};
    const rows = Object.values(days[settingsApi.dayKey()] ?? {});
    const count = rows.reduce((total, row) => total + (row.story ?? 0) + (row.custom ?? 0) + (row.gta ?? 0), 0);
    activity.hidden = !saved.historyEnabled;
    activity.textContent = count + (count === 1 ? " post covered today ↗" : " posts covered today ↗");
  }

  function showMessage(text, error = false) {
    message.hidden = !text;
    message.textContent = text;
    message.toggleAttribute("data-error", error);
  }

  function addWindow(from = "", to = "", focus = false) {
    const row = windowTemplate.content.firstElementChild.cloneNode(true);
    const start = row.querySelector("[data-start]");
    const end = row.querySelector("[data-end]");
    const remove = row.querySelector("button");
    start.value = from;
    end.value = to;
    for (const input of [start, end]) {
      input.addEventListener("input", () => {
        end.setCustomValidity("");
        showMessage("");
      });
    }
    remove.addEventListener("click", () => {
      editing = true;
      const next = row.nextElementSibling ?? row.previousElementSibling;
      row.remove();
      (next?.querySelector("[data-start]") ?? addWindowButton).focus();
      showMessage("");
    });
    windows.append(row);
    if (focus) start.focus();
  }

  function renderSettings(settings) {
    form.elements.mode.value = settings.mode;
    form.elements.scope.value = settings.scope;
    schedule.hidden = settings.mode !== "scheduled";
    startAt.value = settings.startAt;
    windows.replaceChildren();
    for (const { from, to } of settings.windows) addWindow(from, to);
    updateStatus();
  }

  async function apply(patch, success = "") {
    savingMode = patch.mode ?? saved.mode;
    form.setAttribute("aria-busy", "true");
    try {
      saved = settingsApi.normalize(await settingsApi.save(patch));
      if (patch.mode) editing = false;
      updateStatus();
      updateTab();
      showMessage(success);
    } catch (error) {
      if (!editing) renderSettings(saved);
      showMessage(error.message, true);
    } finally {
      savingMode = "";
      form.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "scope") {
      if (!savingMode) apply({ scope: event.target.value });
      return;
    }
    if (event.target.name !== "mode") return;
    if (savingMode) {
      form.elements.mode.value = savingMode;
      return;
    }
    const mode = event.target.value;
    schedule.hidden = mode !== "scheduled";
    showMessage("");
    editing = mode === "scheduled";
    if (!editing) apply({ mode });
  });

  addWindowButton.addEventListener("click", () => {
    editing = true;
    addWindow("", "", true);
  });
  schedule.addEventListener("input", () => {
    editing = true;
    showMessage("");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (schedule.hidden || savingMode) return;

    const hours = [];
    for (const row of windows.children) {
      const from = row.querySelector("[data-start]");
      const to = row.querySelector("[data-end]");
      if (from.value === to.value) {
        to.setCustomValidity("Choose an end time different from the start time.");
        to.reportValidity();
        return;
      }
      hours.push({ from: from.value, to: to.value });
    }

    if (!startAt.value && !hours.length) {
      showMessage("Choose a start date or add browsing hours.", true);
      return;
    }
    if (startAt.value && !settingsApi.localDate(startAt.value)) {
      showMessage("Enter a valid start date and time.", true);
      startAt.focus();
      return;
    }
    apply({ mode: "scheduled", startAt: startAt.value, windows: hours }, "Schedule saved.");
  });

  settingsApi.subscribe((settings) => {
    receivedChange = true;
    saved = settings;
    if (editing || savingMode) updateStatus();
    else renderSettings(saved);
    updateActivity().catch(() => {});
    updateTab();
  });
  settingsApi.read().then((settings) => {
    if (!receivedChange) saved = settings;
    loaded = true;
    renderSettings(saved);
    updateActivity().catch(() => {});
    updateTab();
  }).catch(() => {
    label.textContent = "Settings unavailable";
    showMessage("Reopen the popup to try again.", true);
  });
  document.addEventListener("visibilitychange", () => {
    if (loaded) updateStatus();
  });
  settingsApi.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && settingsApi.activityKey in changes) updateActivity().catch(() => {});
  });
  coverTab.addEventListener("click", async () => {
    try {
      await settingsApi.api.tabs.sendMessage(tabId, { ns6: "cover-tab" });
      showMessage("Revealed posts covered on this tab.");
    } catch {
      showMessage("Reload this tab to reconnect the shield.", true);
    }
  });
})();
