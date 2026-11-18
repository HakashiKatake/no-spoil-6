(() => {
  const S = globalThis.NoSpoilSettings;
  const byId = (id) => document.getElementById(id);
  const filter = byId("filter-form");
  const sites = byId("site-switches");
  const blocks = byId("block-list");
  const blockForm = byId("block-form");
  const lockForm = byId("lock-form");
  const unlockForm = byId("unlock-form");
  const importFile = byId("import-file");
  const filterLists = ["phrases", "allowWords", "contextWords", "topicWords"];
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const switches = new Map();
  let saved;
  let filterBase;
  let dirty = false;
  let busy = false;
  let activityRead = 0;

  for (const [platform, name] of Object.entries(S.platforms)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.className = "check";
    input.type = "checkbox";
    label.append(input, name);
    sites.append(label);
    switches.set(platform, input);
  }

  function message(section, text, error = false) {
    const element = byId(section + "-message");
    element.hidden = !text;
    element.textContent = text;
    element.toggleAttribute("data-error", error);
  }

  function filterValues() {
    const fields = filter.elements;
    const values = {
      scope: fields.scope.value,
      peekSeconds: Number(fields.peek.value),
      maskTitle: fields.maskTitle.checked,
      historyEnabled: fields.historyEnabled.checked,
      disabledSites: [...switches].filter(([, input]) => !input.checked).map(([id]) => id)
    };
    for (const name of filterLists) {
      const entries = fields[name].value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean);
      if (entries.length > S.maxItems || entries.some((term) => term.length > 100)) {
        throw new Error("Use up to " + S.maxItems + " phrases per list with at most 100 characters per phrase.");
      }
      values[name] = [...new Set(entries)];
    }
    return values;
  }

  function renderFilters() {
    const fields = filter.elements;
    fields.scope.value = saved.scope;
    fields.peek.value = String(saved.peekSeconds);
    fields.maskTitle.checked = saved.maskTitle;
    fields.historyEnabled.checked = saved.historyEnabled;
    for (const name of filterLists) fields[name].value = saved[name].join("\n");
    for (const [platform, input] of switches) input.checked = !saved.disabledSites.includes(platform);
    filterBase = filterValues();
  }

  function renderBlocks() {
    blocks.replaceChildren();
    for (const block of saved.siteBlocks) {
      const item = document.createElement("li");
      const body = document.createElement("div");
      const title = document.createElement("strong");
      const hours = document.createElement("p");
      const remove = document.createElement("button");
      title.textContent = block.target;
      hours.textContent = block.from ? block.from + "–" + block.to + " daily" : "All day";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + block.target);
      remove.disabled = busy || S.locked(saved);
      remove.addEventListener("click", async () => {
        await act("block", "remove-block", block, "Site block removed.");
        byId("block-target").focus();
      });
      body.append(title, hours);
      item.append(body, remove);
      blocks.append(item);
    }
  }

  function updateControls() {
    const locked = saved && S.locked(saved);
    for (const fieldset of document.querySelectorAll("[data-preferences]")) {
      fieldset.disabled = !saved || busy || locked;
    }
    for (const button of blocks.querySelectorAll("button")) button.disabled = busy || locked;
    byId("locked-note").hidden = !locked;
    byId("lock-fields").disabled = !saved || busy || locked;
    lockForm.hidden = locked;
    byId("unlock-controls").hidden = !locked;
    byId("export").disabled = !saved || busy;
    byId("import").disabled = !saved || busy || locked;
    byId("sync").disabled = !saved || busy || !S.storage?.sync || (locked && !saved.sync);
    if (saved && !busy) byId("sync").checked = saved.sync;
    if (!locked) return;

    const finish = dateFormat.format(saved.lockUntil);
    byId("locked-note").textContent = "Shield locked until " + finish;
    const remaining = Math.max(0, Math.ceil((saved.unlockReady - Date.now()) / 1000));
    byId("unlock-status").textContent = saved.unlockReady && remaining
      ? "Early unlock available in " + Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0") + "."
      : "The shield is locked until " + finish + ".";
    byId("begin-unlock").hidden = Boolean(saved.unlockReady);
    byId("begin-unlock").disabled = busy;
    unlockForm.hidden = !saved.unlockReady || remaining > 0;
    for (const control of unlockForm.elements) control.disabled = busy;
  }

  function receive(settings) {
    saved = S.normalize(settings);
    if (!dirty) renderFilters();
    renderBlocks();
    updateControls();
  }

  async function act(section, action, payload, success, after) {
    if (!saved || busy) return;
    busy = true;
    updateControls();
    message(section, "");
    try {
      const result = await S.request(action, payload);
      if (result && action !== "clear-activity") {
        after?.();
        receive(result);
      }
      message(section, success);
    } catch (error) {
      message(section, error.message, true);
    } finally {
      busy = false;
      updateControls();
    }
  }

  for (const event of ["input", "change"]) filter.addEventListener(event, () => { dirty = true; });
  filter.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const changes = Object.fromEntries(Object.entries(filterValues()).filter(([name, value]) =>
        JSON.stringify(value) !== JSON.stringify(filterBase[name])));
      act("filter", "save", changes, "Filters saved.", () => { dirty = false; });
    } catch (error) {
      message("filter", error.message, true);
    }
  });

  blockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = blockForm.elements;
    act("block", "add-block", {
      target: fields.target.value, from: fields.from.value, to: fields.to.value
    }, "Site block added.", () => blockForm.reset());
  });

  lockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const until = S.localDate(byId("lock-until").value);
    if (!until || until <= new Date()) {
      message("lock", "Choose a future date and time.", true);
      return;
    }
    act("lock", "lock", until.getTime(), "Shield locked.");
  });
  byId("begin-unlock").addEventListener("click", () => act("lock", "start-unlock", null, "Cooldown started."));
  unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    act("lock", "unlock", byId("unlock-sentence").value.trim(), "Shield unlocked.", () => unlockForm.reset());
  });

  byId("export").addEventListener("click", () => {
    const json = JSON.stringify({ format: "no-spoil-6", version: 1, settings: S.portable(saved) }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = "no-spoil-6-settings.json";
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message("backup", "Settings exported.");
  });
  byId("import").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    importFile.value = "";
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Choose a No Spoil 6 settings file under 1 MB.");
      const backup = JSON.parse(await file.text());
      if (backup.format !== "no-spoil-6" || backup.version !== 1 || !backup.settings || Array.isArray(backup.settings)
        || typeof backup.settings !== "object") throw new Error("Choose an exported No Spoil 6 settings file.");
      await act("backup", "save", backup.settings, "Settings imported.", () => { dirty = false; });
    } catch (error) {
      message("backup", error instanceof SyntaxError ? "This file isn’t a valid settings export." : error.message, true);
    }
  });
  byId("sync").addEventListener("change", (event) => {
    act("backup", "sync", event.target.checked, "Sync preference saved.", () => { dirty = false; });
  });

  function covered(row) {
    return (row.gta ?? 0) + (row.story ?? 0) + (row.custom ?? 0);
  }

  function streak(days, today) {
    let daysWithoutReveal = 0;
    const cursor = new Date(today);
    if (!days[S.dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (daysWithoutReveal < 30) {
      const rows = Object.values(days[S.dayKey(cursor)] ?? {});
      if (!rows.some((row) => covered(row) + (row.blocked ?? 0) > 0) || rows.some((row) => row.revealed > 0)) break;
      daysWithoutReveal++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return daysWithoutReveal;
  }

  async function renderActivity() {
    const read = ++activityRead;
    const days = (await S.storage.local.get(S.activityKey))[S.activityKey] ?? {};
    if (read !== activityRead) return;
    const now = new Date();
    const today = Object.values(days[S.dayKey(now)] ?? {});
    byId("today-count").textContent = today.reduce((total, row) => total + covered(row), 0);
    byId("today-blocks").textContent = today.reduce((total, row) => total + (row.blocked ?? 0), 0);
    byId("streak").textContent = streak(days, now);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 29);
    const visibleDays = Object.keys(days).filter((day) => day >= S.dayKey(cutoff) && day <= S.dayKey(now)).sort().reverse();
    const table = byId("activity-rows");
    table.replaceChildren();
    for (const day of visibleDays) {
      for (const [site, row] of Object.entries(days[day])) {
        const tr = document.createElement("tr");
        for (const value of [day, S.platforms[site], covered(row) + " posts · " + (row.blocked ?? 0) + " pages", row.revealed ?? 0]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          tr.append(cell);
        }
        table.append(tr);
      }
    }
    byId("activity-table").hidden = visibleDays.length === 0;
    byId("activity-hint").hidden = visibleDays.length > 0;
    byId("clear-activity").disabled = Object.keys(days).length === 0;
  }

  byId("clear-activity").addEventListener("click", async () => {
    await act("activity", "clear-activity", null, "Activity cleared.");
    await renderActivity().catch(() => {});
  });
  S.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && S.activityKey in changes) renderActivity().catch(() => {});
  });
  S.subscribe(receive);
  S.read().then((value) => {
    if (!saved) receive(value);
  }).catch(() => message("filter", "Couldn’t read settings. Reopen this page to try again.", true));
  renderActivity().catch(() => {});
  setInterval(updateControls, 1000);
})();
