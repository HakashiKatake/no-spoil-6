(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const storage = api?.storage ?? globalThis.chrome?.storage;
  const key = "shieldSettings";
  const syncKey = "shieldPreferences";
  const activityKey = "shieldActivity";
  const modes = ["always", "scheduled", "paused"];
  const scopes = ["everything", "story", "custom"];
  const platforms = {
    x: "X", youtube: "YouTube", instagram: "Instagram", reddit: "Reddit",
    facebook: "Facebook", tiktok: "TikTok", bluesky: "Bluesky", linkedin: "LinkedIn", threads: "Threads", other: "Other websites"
  };
  const fields = [
    "mode", "startAt", "windows", "scope", "disabledSites", "phrases", "contextWords", "topicWords",
    "allowWords", "siteBlocks", "peekSeconds", "maskTitle", "historyEnabled"
  ];
  const kinds = { gta: "GTA 6 post", story: "Story spoiler", custom: "Custom match", blocked: "Page blocked", revealed: "Post revealed" };
  const unlockPhrase = "I want to unlock my shield";
  const unlockDelay = 30 * 60 * 1000;
  const maxItems = 40;

  function localDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function validTime(value) {
    return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function cleanPhrases(value) {
    return Array.isArray(value) ? [...new Set(value.filter((term) => typeof term === "string")
      .map((term) => term.trim()).filter((term) => term.length > 0 && term.length <= 100))].slice(0, maxItems) : [];
  }

  function parseTarget(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 280) return null;
    try {
      const input = value.trim();
      const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : "https://" + input);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) return null;
      if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
      const host = url.hostname.replace(/^www\./, "");
      const path = url.pathname.replace(/\/+$/, "");
      const port = url.port ? ":" + url.port : "";
      return { host, port: url.port, path, query: url.search, target: host + port + path + url.search };
    } catch {
      return null;
    }
  }

  function normalizeBlock(block) {
    const target = parseTarget(block?.target);
    const from = block?.from || "";
    const to = block?.to || "";
    if (!target || ((from || to) && (!validTime(from) || !validTime(to) || from === to))) return null;
    return { target: target.target, from, to };
  }

  function normalize(value = {}) {
    if (!value || typeof value !== "object") value = {};
    const windows = Array.isArray(value.windows) ? value.windows.filter((window) =>
      window && validTime(window.from) && validTime(window.to) && window.from !== window.to
    ).slice(0, maxItems).map(({ from, to }) => ({ from, to })) : [];
    const blocks = Array.isArray(value.siteBlocks) ? value.siteBlocks.map(normalizeBlock).filter(Boolean) : [];
    const timestamp = (candidate) => Number.isSafeInteger(candidate) && candidate > 0 ? candidate : 0;

    return {
      mode: modes.includes(value.mode) ? value.mode : "always",
      startAt: typeof value.startAt === "string" && localDate(value.startAt) ? value.startAt : "",
      windows,
      scope: scopes.includes(value.scope) ? value.scope : "everything",
      disabledSites: Array.isArray(value.disabledSites) ? [...new Set(value.disabledSites.filter((site) => Object.hasOwn(platforms, site)))] : [],
      phrases: cleanPhrases(value.phrases),
      contextWords: cleanPhrases(value.contextWords),
      topicWords: cleanPhrases(value.topicWords),
      allowWords: cleanPhrases(value.allowWords),
      siteBlocks: blocks.slice(0, maxItems),
      peekSeconds: [0, 15, 30, 60].includes(value.peekSeconds) ? value.peekSeconds : 15,
      maskTitle: value.maskTitle !== false,
      historyEnabled: value.historyEnabled !== false,
      sync: value.sync === true,
      lockUntil: timestamp(value.lockUntil),
      unlockReady: timestamp(value.unlockReady)
    };
  }

  function portable(settings) {
    return Object.fromEntries(fields.map((field) => [field, settings[field]]));
  }

  function minutes(time) {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  }

  function insideWindow({ from, to }, now) {
    const localMinutes = now.getHours() * 60 + now.getMinutes();
    const first = minutes(from);
    const last = minutes(to);
    return first < last
      ? localMinutes >= first && localMinutes < last
      : localMinutes >= first || localMinutes < last;
  }

  function status(settings, now = new Date()) {
    if (settings.mode === "paused") return "paused";
    if (settings.mode === "always") return "active";

    const start = settings.startAt && localDate(settings.startAt);
    if (start && now < start) return "waiting";
    if (!settings.windows.length) return start ? "active" : "waiting";
    return settings.windows.some((window) => insideWindow(window, now)) ? "active" : "outside";
  }

  function siteBlock(settings, url, now = new Date()) {
    if (settings.mode === "paused") return null;
    return settings.siteBlocks.find((block) => {
      if (block.from && !insideWindow(block, now)) return false;
      const target = parseTarget(block.target);
      if (!target) return false;
      const host = url.hostname.replace(/^www\./, "");
      if (host !== target.host && !host.endsWith("." + target.host)) return false;
      if (target.port && target.port !== url.port) return false;
      const subreddit = target.host === "reddit.com" && /^\/r\/[^/]+$/i.test(target.path);
      const path = subreddit ? url.pathname.toLowerCase() : url.pathname;
      const prefix = subreddit ? target.path.toLowerCase() : target.path;
      if (prefix && path !== prefix && !path.startsWith(prefix + "/")) return false;
      return [...new URLSearchParams(target.query)].every(([name, value]) => url.searchParams.getAll(name).includes(value));
    }) ?? null;
  }

  function locked(settings, now = Date.now()) {
    return settings.lockUntil > now;
  }

  function dayKey(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  async function read() {
    const values = await storage.local.get(key);
    return normalize(values[key]);
  }

  async function request(action, data) {
    const response = await api.runtime.sendMessage({ ns6: action, data });
    if (!response?.ok) throw new Error(response?.error ?? "Open the extension again and retry.");
    return response.value;
  }

  function save(patch) {
    return request("save", patch);
  }

  function subscribe(listener) {
    storage?.onChanged?.addListener((changes, area) => {
      if (area === "local" && key in changes) listener(normalize(changes[key].newValue));
    });
  }

  globalThis.NoSpoilSettings = {
    api, storage, key, syncKey, activityKey, fields, platforms, kinds, maxItems, unlockPhrase, unlockDelay,
    normalize, normalizeBlock, portable, localDate, status, siteBlock, locked, dayKey, read, request, save, subscribe
  };
})();
