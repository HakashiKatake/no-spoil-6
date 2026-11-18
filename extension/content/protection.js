(() => {
  const S = globalThis.NoSpoilSettings;
  const platform = globalThis.NoSpoilRules.adapterFor(location.hostname).id;
  const dayCounts = new Map();
  const gateStyles = new CSSStyleSheet();
  const maskedTitle = "Content covered · No Spoil 6";
  let originalTitle = "";
  let ownsTitle = false;
  let gateHost;
  let guardedBody;
  let bodyWasInert;
  let activityTimer;

  gateStyles.replaceSync(`
    :host {
      all: initial !important; position: fixed !important; inset: 0 !important;
      display: grid !important; place-items: center !important; overflow: auto !important;
      z-index: 2147483647 !important;
      background: radial-gradient(ellipse at 75% 18%, #322144, #100e19 72%) !important;
      color: #f7f1ff !important; font: 16px/1.5 system-ui, sans-serif !important;
    }
    main { box-sizing: border-box; width: min(460px, calc(100vw - 32px)); padding: clamp(20px, 6vw, 40px);
      background: #1d1728; border: 1px solid #735789; border-radius: 20px; }
    strong { color: #d9b9ff; font-size: 13px; }
    h1 { margin: 10px 0; font-size: clamp(26px, 6vw, 40px); line-height: 1.05; letter-spacing: -.045em; }
    p { color: #d6c8e2; margin: 0 0 19px; }
    button { border: 0; border-radius: 8px; padding: 9px 14px; background: #dcbbff; color: #241235;
      font: 650 14px/1.5 system-ui, sans-serif; cursor: pointer; }
    button:focus-visible { outline: 2px solid #ead8ff; outline-offset: 4px; }
  `);

  function maskDocumentTitle(shouldMask) {
    if (shouldMask) {
      if (document.title !== maskedTitle) {
        originalTitle = document.title;
        document.title = maskedTitle;
        ownsTitle = true;
      }
    } else if (ownsTitle) {
      if (document.title === maskedTitle) document.title = originalTitle;
      ownsTitle = false;
    }
  }

  function titleForMatching() {
    return ownsTitle && document.title === maskedTitle ? originalTitle : document.title;
  }

  function restoreBody() {
    if (guardedBody && !bodyWasInert) guardedBody.inert = false;
    guardedBody = null;
  }

  function createGate() {
    const host = document.createElement("div");
    host.setAttribute("data-no-spoil-control", "");
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.adoptedStyleSheets = [gateStyles];
    const card = document.createElement("main");
    const brand = document.createElement("strong");
    brand.textContent = "No Spoil 6";
    const title = document.createElement("h1");
    title.textContent = "Page blocked";
    const detail = document.createElement("p");
    detail.textContent = "This page matches one of your site blocks. Manage your rules from the extension settings.";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Go back";
    back.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.replace("about:blank");
    });
    card.append(brand, title, detail, back);
    shadow.append(card);
    return host;
  }

  function setGate(blocked) {
    const root = document.documentElement;
    if (!root) return;

    root.toggleAttribute("data-no-spoil-page-blocked", blocked);
    if (blocked) {
      gateHost ??= createGate();
      if (!gateHost.isConnected) root.append(gateHost);
      if (guardedBody !== document.body) {
        restoreBody();
        guardedBody = document.body;
        if (guardedBody) {
          bodyWasInert = guardedBody.inert;
          guardedBody.inert = true;
        }
      }
    } else {
      gateHost?.remove();
      restoreBody();
    }
  }

  function flush() {
    clearTimeout(activityTimer);
    activityTimer = undefined;
    for (const [day, counts] of dayCounts) {
      S.request("activity", { day, counts, platform }).catch(() => {});
    }
    dayCounts.clear();
  }

  function record(kind) {
    const day = S.dayKey();
    const counts = dayCounts.get(day) ?? {};
    counts[kind] = (counts[kind] ?? 0) + 1;
    dayCounts.set(day, counts);

    activityTimer ??= setTimeout(flush, 450);
  }

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flush();
  });

  globalThis.NoSpoilProtection = { setGate, maskDocumentTitle, titleForMatching, record };
})();
