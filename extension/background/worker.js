if (typeof importScripts === "function") importScripts("../shared/settings.js");

(() => {
  const S = globalThis.NoSpoilSettings;
  const { api, storage, key, syncKey, activityKey } = S;
  let pending = Promise.resolve();

  function enqueue(operation) {
    const next = pending.then(operation);
    pending = next.catch(() => {});
    return next;
  }

  async function persist(settings, upload = false) {
    if (settings.sync && upload) {
      const data = S.portable(settings);
      if (new TextEncoder().encode(JSON.stringify(data)).length > 7800) {
        throw new Error("This settings file is too large for browser sync. Turn sync off or shorten your lists.");
      }
      try {
        await storage.sync.set({ [syncKey]: data });
      } catch {
        throw new Error("Browser sync couldn’t save these settings. Try again or turn sync off.");
      }
    }
    await storage.local.set({ [key]: settings });
    return settings;
  }

  function applyPatch(current, patch) {
    const values = { ...current };
    for (const field of S.fields) {
      if (Object.hasOwn(patch, field)) values[field] = patch[field];
    }
    return S.normalize(values);
  }

  async function updateSettings(action, data) {
    const current = await S.read();
    const now = Date.now();
    const isLocked = S.locked(current, now);

    if (action === "start-unlock") {
      if (!isLocked || current.unlockReady) return current;
      return persist({ ...current, unlockReady: now + S.unlockDelay });
    }
    if (action === "unlock") {
      if (!isLocked) return current;
      if (!current.unlockReady || now < current.unlockReady || data !== S.unlockPhrase) {
        throw new Error("Finish the cooldown and type the displayed sentence to unlock.");
      }
      return persist({ ...current, lockUntil: 0, unlockReady: 0 });
    }
    if (action === "sync" && data === false) {
      return persist({ ...current, sync: false });
    }
    if (isLocked) throw new Error("Your shield settings are locked.");
    if (action === "lock") {
      if (!Number.isSafeInteger(data) || data <= now || current.mode === "paused") {
        throw new Error("Choose a future unlock time and turn on the shield before locking.");
      }
      return persist({ ...current, lockUntil: data, unlockReady: 0 });
    }
    if (action === "sync") {
      if (!storage.sync) throw new Error("This browser does not offer extension settings sync.");
      const remote = (await storage.sync.get(syncKey))[syncKey];
      if (remote && typeof remote === "object") return persist({ ...applyPatch(current, remote), sync: true });
      return persist({ ...current, sync: true }, true);
    }
    if (action === "add-block" || action === "remove-block") {
      const block = S.normalizeBlock(data);
      if (!block) throw new Error("Enter a website and either two different times or no times.");
      const same = (entry) => entry.target === block.target && entry.from === block.from && entry.to === block.to;
      let siteBlocks = current.siteBlocks.filter((entry) => !same(entry));
      if (action === "add-block") {
        if (siteBlocks.length === S.maxItems) throw new Error("You can save up to " + S.maxItems + " site blocks.");
        siteBlocks = [...siteBlocks, block];
      }
      return persist({ ...current, siteBlocks }, true);
    }
    if (action === "save" && data && typeof data === "object" && !Array.isArray(data)) {
      return persist(applyPatch(current, data), true);
    }
    throw new Error("Invalid settings request.");
  }

  async function addActivity(data) {
    const { day, platform, counts } = data ?? {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Object.hasOwn(S.platforms, platform) || !counts) return;
    if (!(await S.read()).historyEnabled) return;
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    if (day < S.dayKey(cutoff) || day > S.dayKey(today)) return;
    const days = (await storage.local.get(activityKey))[activityKey] ?? {};
    for (const oldDay of Object.keys(days)) if (oldDay < S.dayKey(cutoff)) delete days[oldDay];
    const row = (days[day] ??= {})[platform] ??= {};
    for (const kind of Object.keys(S.kinds)) {
      const amount = counts[kind];
      if (Number.isSafeInteger(amount) && amount > 0) row[kind] = (row[kind] ?? 0) + Math.min(amount, 10000);
    }
    await storage.local.set({ [activityKey]: days });
  }

  const settingsActions = new Set(["save", "lock", "start-unlock", "unlock", "sync", "add-block", "remove-block"]);
  const settingsSource = api.runtime.getURL("");
  api.runtime.onMessage.addListener((message, sender, reply) => {
    const action = message?.ns6;
    const settingsPage = sender.url?.startsWith(settingsSource);
    let run;
    if (action === "activity" && sender.tab) run = () => addActivity(message.data);
    if (action === "clear-activity" && settingsPage) run = () => storage.local.remove(activityKey);
    if (settingsActions.has(action) && settingsPage) run = () => updateSettings(action, message.data);
    if (!run) return false;
    enqueue(run).then((value) => reply({ ok: true, value }), (error) => reply({ ok: false, error: error.message }));
    return true;
  });

  storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[syncKey]?.newValue) return;
    enqueue(async () => {
      const current = await S.read();
      if (!current.sync || S.locked(current)) return;
      const remote = (await storage.sync.get(syncKey))[syncKey];
      if (!remote || typeof remote !== "object") return;
      const next = applyPatch(current, remote);
      if (JSON.stringify(S.portable(next)) !== JSON.stringify(S.portable(current))) await persist(next);
    }).catch(() => {});
  });
})();
