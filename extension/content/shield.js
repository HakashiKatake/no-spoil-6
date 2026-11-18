(() => {
  const settingsApi = globalThis.NoSpoilSettings;
  const protection = globalThis.NoSpoilProtection;
  const { matches, createMatcher, adapterFor } = globalThis.NoSpoilRules;
  const { id: platform, selector: primary } = adapterFor(location.hostname);
  const onYouTube = /(?:^|\.)(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(location.hostname);
  const fallback = "a[href],p,h1,h2,h3,h4,h5,h6,[role=heading],figure";
  const candidates = primary + "," + fallback;
  const separate = 'shreddit-post,shreddit-comment,.thing[data-fullname],[data-comment-id]';
  const excluded = 'script,style,noscript,template,textarea,select,input,[contenteditable]:not([contenteditable=false]),[data-no-spoil-control]';
  const evidenceAttributes = ["alt", "title", "aria-label", "post-title", "subreddit-name", "subreddit-prefixed-name", "data-title"];
  const watchedAttributes = [...evidenceAttributes, "href", "video-id", "hidden", "data-post-id", "data-comment-id", "data-fullname", "post-id"];
  const mediaSelector = "video,audio";
  const layoutStyles = new CSSStyleSheet();
  layoutStyles.replaceSync(`
    [data-no-spoil-covered] { isolation: isolate !important; user-select: none !important; }
    [data-no-spoil-positioned] { position: relative !important; }
    [data-no-spoil-box] { display: block !important; }
    :root[data-no-spoil-page-blocked] body { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
  `);

  const overlayStyles = new CSSStyleSheet();
  overlayStyles.replaceSync(`
    :host {
      all: initial !important;
      position: absolute !important;
      inset: 0 !important;
      display: block !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      direction: ltr !important;
      color-scheme: dark !important;
      border-radius: inherit !important;
    }
    .cover {
      position: absolute; inset: 0; display: grid; place-items: start center;
      padding: 0 6px; box-sizing: border-box; overflow: hidden;
      border: 1px solid #cfafff33; border-radius: inherit; pointer-events: auto;
      background: linear-gradient(125deg, #211534, #120e20);
      container-type: size;
    }
    @supports (backdrop-filter: blur(18px)) or (-webkit-backdrop-filter: blur(18px)) {
      .cover {
        background: linear-gradient(125deg, #211534da, #120e20d2);
        backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      }
    }
    button {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      box-sizing: border-box; height: 34px; max-width: 100%; padding: 0 12px;
      border: 1px solid #b593f380; border-radius: 8px; background: #201631;
      color: #fbf6ff; font: 600 12px/1 system-ui, sans-serif; white-space: nowrap;
      cursor: pointer; pointer-events: auto;
    }
    button:hover { background: #37234e; border-color: #c3a2ff; }
    button:focus-visible { outline: 2px solid #e3cfff; outline-offset: -3px; }
    .cover button { margin-top: min(14px, 14cqh); }
    .eye {
      width: 13px; height: 8px; flex: 0 0 auto; position: relative;
      border: 1.5px solid #d8baff; border-radius: 70% 70% 70% 70% / 85% 85% 85% 85%;
    }
    .eye::before {
      content: ""; position: absolute; inset: 0; margin: auto;
      width: 4px; height: 4px; border-radius: 50%; background: #d8baff;
    }
    .revealed .eye::after {
      content: ""; position: absolute; width: 17px; height: 1.5px;
      border-bottom: 1.5px solid #201631; background: #d8baff;
      transform: rotate(-35deg); left: -2px; top: 3px;
    }
    .revealed {
      position: absolute; inset: 5px auto auto 5px; height: 28px; width: 32px; padding: 0;
    }
    .revealed { width: auto; min-width: 32px; padding-inline: 7px; }
    .revealed .label:empty { display: none; }
    button:disabled { cursor: default; background: #261b34; }
    @container (max-width: 155px) {
      .cover button { width: 32px; padding: 0; }
      .cover .label { display: none; }
    }
    @container (max-height: 40px) {
      .cover button { align-self: center; margin-top: 0; height: clamp(16px, 100cqh - 4px, 30px); border-radius: 5px; }
    }
  `);

  let settings = settingsApi.normalize();
  let classify = createMatcher(settings);
  let active = false;
  let blocked = false;
  let locked = false;
  let ready = false;
  let watching = false;
  let lastUrl = location.href;
  let observedRoots = new WeakSet();
  let timer;
  const shields = new Map();
  const counted = new WeakMap();
  const observer = new MutationObserver(processMutations);

  function parentOf(element) {
    return element.parentElement ?? element.getRootNode().host ?? null;
  }

  function closestAcrossRoots(element, selector) {
    for (let current = element; current; current = parentOf(current)) {
      if (current.matches(selector)) return current;
    }
    return null;
  }

  function candidateFor(element) {
    const post = closestAcrossRoots(element, primary);
    if (post) return post;

    const nearest = element.closest(fallback);
    if (nearest?.localName === "a") {
      return nearest.parentElement?.closest("p,h1,h2,h3,h4,h5,h6,[role=heading],figure") ?? nearest;
    }
    return nearest;
  }

  function decode(value) {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  }

  function linkEvidence(link) {
    try {
      const url = new URL(link, location.href);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.hostname + decode(url.pathname + url.search);
      }
    } catch {
      // Ignore incomplete or invalid URLs.
    }
    return "";
  }

  function readEvidence(target) {
    const text = [];
    const links = [];
    const identity = [];
    const pending = [target];

    while (pending.length) {
      const node = pending.pop();
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.trim()) text.push(node.nodeValue);
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches(excluded) || (node !== target && node.matches(separate))) continue;
        for (const attr of evidenceAttributes) {
          const value = node.getAttribute(attr);
          if (value) text.push(value);
        }
        const href = node.getAttribute("href");
        if (href) {
          const url = linkEvidence(href);
          if (url) links.push(url);
          const permalink = url.match(/\/(?:status|comments|reel|p|shorts|video)\/[^/?#]+|\/watch\?v=[^&#]+/);
          if (permalink) identity.push(permalink[0]);
        }
        for (const attr of ["post-id", "video-id", "data-post-id", "data-comment-id", "data-fullname", "thingid"]) {
          const value = node.getAttribute(attr);
          if (value) identity.push(value);
        }
        if (node.shadowRoot) pending.push(node.shadowRoot);
      }
      for (let child = node.lastChild; child; child = child.previousSibling) pending.push(child);
    }
    const visible = text.join(" ").replace(/\s+/g, " ").trim();
    return {
      searchable: visible + " " + links.join(" "),
      signature: [visible, ...identity].join("\n")
    };
  }

  function coveredAncestor(target) {
    for (let current = parentOf(target); current; current = parentOf(current)) {
      const state = shields.get(current);
      if (state && !state.revealed) return true;
    }
    return false;
  }

  function suppressMedia(target) {
    for (const media of target.querySelectorAll(mediaSelector)) media.pause();
  }

  function pauseCoveredMedia(event) {
    const media = event.target;
    if (media.matches?.(mediaSelector) && (blocked || (shields.size && coveredAncestor(media)))) media.pause();
  }

  function syncInert(state) {
    for (const child of state.inert) {
      if (child.parentElement === state.target) continue;
      child.removeAttribute("inert");
      state.inert.delete(child);
    }
    for (const child of state.target.children) {
      if (child === state.host || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      state.inert.add(child);
    }
    suppressMedia(state.target);
  }

  function restoreInert(state) {
    for (const child of state.inert) child.removeAttribute("inert");
    state.inert.clear();
  }

  function preventCoveredInteraction(state, event) {
    if (!state.revealed && !event.composedPath().includes(state.host)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function render(state, transferFocus = false) {
    const { target, shadow, cover, button, label, revealed } = state;
    const layout = getComputedStyle(target);
    const fixedPosition = layout.position === "static" || target.hasAttribute("data-no-spoil-positioned");
    const needsBox = !revealed && (layout.display === "contents" || target.hasAttribute("data-no-spoil-box"));
    target.toggleAttribute("data-no-spoil-covered", !revealed);
    target.toggleAttribute("data-no-spoil-positioned", fixedPosition);
    target.toggleAttribute("data-no-spoil-box", needsBox);
    if (revealed) {
      restoreInert(state);
      cover.remove();
      shadow.append(button);
    } else {
      shadow.append(cover);
      cover.append(button);
      syncInert(state);
    }
    button.classList.toggle("revealed", revealed);
    const subject = state.kind === "custom" ? "post" : "GTA 6 post";
    button.disabled = locked;
    button.title = locked ? "Shield locked" : revealed ? "Hide " + subject + " again" : "Reveal " + subject;
    button.setAttribute("aria-label", button.title);
    label.textContent = revealed ? "" : button.title;
    if (transferFocus) button.focus({ preventScroll: true });
  }

  function coverAgain(state, focus = false) {
    clearTimeout(state.peekTimer);
    state.deadline = 0;
    state.revealed = false;
    render(state, focus);
  }

  function updateReveal(state) {
    if (!state.revealed || !state.deadline) return;
    clearTimeout(state.peekTimer);
    const left = state.deadline - Date.now();
    if (left <= 0) {
      coverAgain(state, state.shadow.activeElement === state.button);
      scanSubtree(state.target);
      return;
    }
    state.label.textContent = Math.ceil(left / 1000) + "s";
    state.peekTimer = setTimeout(() => updateReveal(state), left % 1000 || 1000);
  }

  function addShield(target, signature, kind) {
    const host = document.createElement("span");
    host.setAttribute("data-no-spoil-control", "");
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.adoptedStyleSheets = [overlayStyles];

    const cover = document.createElement("span");
    cover.className = "cover";
    const button = document.createElement("button");
    button.type = "button";
    const eye = document.createElement("span");
    eye.className = "eye";
    eye.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "label";
    button.append(eye, label);

    const state = { target, signature, kind, host, shadow, cover, button, label, revealed: false, deadline: 0, inert: new Set() };
    state.onClick = (event) => preventCoveredInteraction(state, event);
    state.onFocus = (event) => {
      if (!state.revealed && event.target === target) button.focus({ preventScroll: true });
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (locked) return;
      if (state.revealed) {
        coverAgain(state, true);
      } else {
        state.revealed = true;
        state.deadline = settings.peekSeconds ? Date.now() + settings.peekSeconds * 1000 : 0;
        if (settings.historyEnabled) protection.record("revealed");
        render(state, true);
        updateReveal(state);
      }
      scanSubtree(target);
    });
    target.addEventListener("click", state.onClick, true);
    target.addEventListener("auxclick", state.onClick, true);
    target.addEventListener("focus", state.onFocus);

    shields.set(target, state);
    target.append(host);
    render(state);
  }

  function removeShield(target) {
    const state = shields.get(target);
    if (!state) return;
    shields.delete(target);
    clearTimeout(state.peekTimer);
    state.host.remove();
    target.removeAttribute("data-no-spoil-covered");
    target.removeAttribute("data-no-spoil-positioned");
    target.removeAttribute("data-no-spoil-box");
    target.removeEventListener("click", state.onClick, true);
    target.removeEventListener("auxclick", state.onClick, true);
    target.removeEventListener("focus", state.onFocus);
    restoreInert(state);
  }

  function reconcile(target, signature, kind, count = true) {
    const state = shields.get(target);
    if (!signature || coveredAncestor(target)) {
      removeShield(target);
      return;
    }
    if (ready && settings.historyEnabled && count && counted.get(target) !== signature) {
      counted.set(target, signature);
      protection.record(kind);
    }
    if (!state) {
      addShield(target, signature, kind);
      return;
    }
    if (state.kind !== kind) {
      state.kind = kind;
      coverAgain(state);
    }
    if (state.host.parentElement !== target) target.append(state.host);
    if (state.signature !== signature) {
      state.signature = signature;
      if (state.revealed) coverAgain(state);
    }
    if (!state.revealed) syncInert(state);
  }

  function inGtaFeed() {
    const path = decode(location.pathname);
    const redditTopic = path.match(/^\/r\/([^/]+)/i);
    const instagramTopic = path.match(/^\/explore\/tags\/([^/]+)/i);
    return (/(?:^|\.)reddit\.com$/.test(location.hostname) && redditTopic && matches(redditTopic[1]))
      || (/(?:^|\.)instagram\.com$/.test(location.hostname) && instagramTopic && matches(instagramTopic[1]))
      || (/(?:^|\.)(?:x\.com|twitter\.com)$/.test(location.hostname)
        && path.startsWith("/hashtag/") && matches(path.slice(9)));
  }

  function scanCandidate(target, topic, watchTargets) {
    if (!target.isConnected || watchTargets.has(target)) return;
    if (closestAcrossRoots(target, excluded)) {
      removeShield(target);
      return;
    }
    if (!target.matches(primary) && candidateFor(target) !== target) {
      removeShield(target);
      return;
    }
    if (coveredAncestor(target)) {
      removeShield(target);
      return;
    }
    const evidence = readEvidence(target);
    const kind = classify(evidence.searchable, topic && target.matches(primary));
    const wasCovered = shields.has(target) && !shields.get(target).revealed;
    reconcile(target, kind ? evidence.signature || location.pathname : "", kind);
    if (!kind && wasCovered) scanSubtree(target);
  }

  function collect(node, found) {
    if (!node?.querySelectorAll || node.matches?.("[data-no-spoil-control]")) return;
    if (node.matches?.(candidates)) found.add(node);
    for (const candidate of node.querySelectorAll(candidates)) found.add(candidate);
    if (node.shadowRoot) collectShadow(node.shadowRoot, found);
    for (const element of node.querySelectorAll("*")) {
      if (element.shadowRoot) collectShadow(element.shadowRoot, found);
    }
  }

  function collectShadow(root, found) {
    observe(root);
    collect(root, found);
  }

  function observe(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    if (!root.adoptedStyleSheets.includes(layoutStyles)) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, layoutStyles];
    }
    root.addEventListener("play", pauseCoveredMedia, true);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: watchedAttributes });
  }

  function scanWatchPage() {
    const watchTargets = new Set();
    if (!onYouTube || !/^\/(?:watch|embed\/|live\/)/.test(location.pathname)) return watchTargets;
    const watch = document.querySelector("ytd-watch-flexy:not([hidden]),ytm-watch") ?? document;
    const videoId = new URL(location.href).searchParams.get("v") ?? location.pathname.split("/")[2];
    const loadedId = watch.getAttribute?.("video-id");
    const title = watch.querySelector("ytd-watch-metadata h1,#title.ytd-watch-metadata h1,.slim-video-metadata-title,.ytp-title-link");
    const player = watch.querySelector("#player-container-outer,#player-container,#movie_player");
    if (!title || (loadedId && videoId && loadedId !== videoId)) return watchTargets;

    const evidence = readEvidence(title);
    const kind = classify(evidence.searchable);
    const signature = kind ? videoId + "\n" + evidence.signature : "";
    for (const target of [player, title]) {
      if (!target) continue;
      watchTargets.add(target);
      reconcile(target, signature, kind, target === title);
    }
    return watchTargets;
  }

  function scan(found) {
    const watchTargets = scanWatchPage();
    const topic = inGtaFeed();
    for (const candidate of found) scanCandidate(candidate, topic, watchTargets);
    for (const [target] of shields) {
      if (!target.isConnected) removeShield(target);
    }
  }

  function scanSubtree(root) {
    const found = new Set();
    collect(root, found);
    scan(found);
  }

  function processMutations(records) {
    if (checkRoute()) return;
    if (blocked) {
      protection.setGate(true);
      syncTitle();
      return;
    }
    if (!active) return;
    const found = new Set();
    const added = new Set();
    let pageChanged = false;
    for (const record of records) {
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement ?? record.target.host;
      if (element?.matches("[data-no-spoil-control]")) continue;
      const addedNodes = [...record.addedNodes].filter((node) => !node.matches?.("[data-no-spoil-control]"));
      const removedContent = [...record.removedNodes].some((node) => !node.matches?.("[data-no-spoil-control]"));
      const orphanedShield = shields.has(element) && shields.get(element).host.parentElement !== element;
      if (record.type === "childList" && !addedNodes.length && !removedContent && !orphanedShield) continue;

      pageChanged = true;
      const candidate = element && candidateFor(element);
      if (candidate) found.add(candidate);
      for (const node of addedNodes) if (node.nodeType === Node.ELEMENT_NODE) added.add(node);
    }
    if (!pageChanged) return;
    syncTitle();
    for (const node of added) {
      if (!node.isConnected) continue;
      let parent = node.parentElement;
      while (parent && !added.has(parent)) parent = parent.parentElement;
      if (!parent) collect(node, found);
    }
    scan(found);
  }

  function checkRoute() {
    if (lastUrl === location.href) return false;
    refresh();
    return true;
  }

  function syncTitle() {
    const title = protection.titleForMatching();
    protection.maskDocumentTitle(blocked || Boolean(active && settings.maskTitle && title && classify(title, inGtaFeed())));
  }

  function refresh(recheck = false) {
    const now = new Date();
    const routeChanged = lastUrl !== location.href;
    if (routeChanged) lastUrl = location.href;
    const nextBlocked = Boolean(ready && window.top === window && settingsApi.siteBlock(settings, new URL(lastUrl), now));
    const nextActive = !nextBlocked && settingsApi.status(settings, now) === "active" && !settings.disabledSites.includes(platform);
    const nextLocked = settingsApi.locked(settings, now.getTime());
    const nextWatching = nextActive || (settings.mode !== "paused" && settings.siteBlocks.length > 0);
    const filteringChanged = nextActive !== active;
    if (filteringChanged || routeChanged) for (const target of shields.keys()) removeShield(target);
    if (nextBlocked && (!blocked || routeChanged)) {
      if (settings.historyEnabled) protection.record("blocked");
      suppressMedia(document);
    }
    blocked = nextBlocked;
    active = nextActive;
    if (nextLocked !== locked) {
      locked = nextLocked;
      for (const state of shields.values()) coverAgain(state);
    }
    if (nextWatching !== watching) {
      watching = nextWatching;
      if (watching) observe(document);
      else {
        observer.disconnect();
        observedRoots = new WeakSet();
      }
    }
    protection.setGate(blocked);
    syncTitle();
    if (active && (filteringChanged || routeChanged || recheck === true)) scanSubtree(document);
    for (const state of [...shields.values()]) {
      if (state.deadline && state.deadline <= now.getTime()) updateReveal(state);
    }

    clearTimeout(timer);
    const minute = 60000 - Date.now() % 60000 + 20;
    timer = setTimeout(refresh, locked ? Math.min(minute, settings.lockUntil - now.getTime() + 20) : minute);
  }

  function applySettings(value) {
    ready = true;
    settings = value;
    classify = createMatcher(settings);
    refresh(true);
  }

  settingsApi.subscribe(applySettings);
  refresh();
  settingsApi.read().then((value) => {
    if (!ready) applySettings(value);
  }).catch(() => {
    // A failed read keeps the shield in its default mode.
    refresh();
  });
  document.addEventListener("visibilitychange", refresh);
  document.addEventListener("DOMContentLoaded", () => {
    refresh(true);
  }, { once: true });
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("popstate", checkRoute);
  window.addEventListener("hashchange", checkRoute);
  window.navigation?.addEventListener("navigatesuccess", checkRoute);
  settingsApi.api?.runtime?.onMessage.addListener((message, _sender, reply) => {
    if (message?.ns6 === "tab-state") {
      reply({ active, blocked, platform });
    } else if (message?.ns6 === "cover-tab") {
      let count = 0;
      for (const state of shields.values()) {
        if (state.revealed) {
          coverAgain(state);
          count++;
        }
      }
      reply({ count });
    }
  });
})();
