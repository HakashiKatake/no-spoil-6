(() => {
  const explicit = [
    /\b(?:gta|grand[\W_]*theft[\W_]*auto)[\W_]*(?:0?6|vi|six)(?=$|[^\p{L}\p{N}]|(?:spoilers?|leaks?|gameplay|trailers?|news|online|official|story|ending|memes?|clips?|countdown|updates?|release)\b)/iu,
    /\b(?:jason[\W_]*duval|lucia[\W_]*caminos|cal[\W_]*hampton|boobie[\W_]*ike|drequan[\W_]*priest|brian[\W_]*heder|ra[uú]l[\W_]*bautista|real[\W_]*dimez)\b/iu,
    /\b(?:port[\W_]*gellhorn|mount[\W_]*kalaga|grassrivers)\b/iu,
    /\bleonida(?![\p{L}\p{N}])/iu,
    /\b(?:jason\s*(?:and|&|x|\+|\/)\s*lucia|lucia\s*(?:and|&|x|\+|\/)\s*jason)\b/iu,
    /\b(?:rockstar[\W_]*(?:games[\W_]*)?(?:\/|[-–—:]\s*)vi|rockstargames\.com\/vi|project[\W_]+americas)\b/iu
  ];
  const viceCity = /\bvice[\W_]*city\b/iu;
  const related = /\b(?:rockstar|trailers?|leaks?|spoilers?|gameplay|new gta|next gta|upcoming gta|return to vice city|welcome to vice city)\b/iu;
  const olderGame = /\b(?:gta[\W_]*(?:v|5|vice[\W_]*city|san[\W_]*andreas)|(?:vice[\W_]*city[\W_]*)?definitive[\W_]*edition|tommy[\W_]*vercetti)\b/iu;
  const storySignal = /\b(?:endings?|finale|epilogue|post[\W_]*credits|final[\W_]*(?:mission|heist|boss)|betray(?:s|al|ed|ing)?|dies|death|killed|plot[\W_]*twists?|cutscenes?|story[\W_]*(?:leak|spoiler|details|breakdown|plot)|spoilers?|leak(?:s|ed|ing)?|script[\W_]*(?:leak|dump))\b/iu;

  function normalize(text) {
    return text.normalize("NFKC")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFE0E\uFE0F]/g, "")
      .replace(/[٦۶]/g, "6");
  }

  function matches(text) {
    const clean = normalize(text);
    return explicit.some((rule) => rule.test(clean))
      || (viceCity.test(clean) && related.test(clean) && !olderGame.test(clean));
  }

  function compileTerms(terms) {
    return terms.map((term) => normalize(term).trim()).filter(Boolean).map((clean) => {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const before = /^[\p{L}\p{N}]/u.test(clean) ? "(?:^|[^\\p{L}\\p{N}])" : "";
      const after = /[\p{L}\p{N}]$/u.test(clean) ? "(?=$|[^\\p{L}\\p{N}])" : "";
      return new RegExp(before + escaped + after, "iu");
    });
  }

  function createMatcher(settings) {
    const allow = compileTerms(settings.allowWords);
    const custom = compileTerms(settings.phrases);
    const contextual = compileTerms(settings.contextWords);
    const topics = compileTerms(settings.topicWords);
    return (text, insideTopic = false) => {
      const clean = normalize(text);
      if (allow.some((term) => term.test(clean))) return "";
      if (custom.some((term) => term.test(clean))) return "custom";
      const gta = insideTopic || matches(clean);
      if (contextual.some((term) => term.test(clean)) && (gta || topics.some((term) => term.test(clean)))) {
        return "custom";
      }
      if (!gta) return "";
      if (settings.scope === "everything") return "gta";
      if (settings.scope === "story" && storySignal.test(clean)) return "story";
      return "";
    };
  }

  const article = 'article,[role="article"]';
  const generic = article + ',[data-post-id],[data-comment-id],[data-testid="post"],[data-testid="comment"],.post,.comment';
  const linkedInPost = [
    '.feed-shared-update-v2', '.occludable-update', '.main-feed-activity-card',
    '[data-view-name="feed-full-update"]', '[data-testid="main-feed-activity-card"]',
    '[data-urn^="urn:li:activity:"]', '[data-urn^="urn:li:ugcPost:"]',
    '[data-id^="urn:li:activity:"]', '[data-activity-urn^="urn:li:activity:"]',
    '[componentkey*="urn:li:activity:"]', '[componentkey*="urn:li:ugcPost:"]',
    '[role="feed"] [role="listitem"]:not([role="listitem"] [role="listitem"])', article
  ].join(",");
  const linkedInText = '[data-view-name*="commentary"],[data-test-id="main-feed-activity-card__commentary"],.update-components-text';
  const linkedInComment = '.comments-comment-item,.comment,[data-view-name="comment-entity"],[data-comment-id]';
  const linkedInActions = '.feed-shared-social-action-bar,.main-feed-activity-card__social-actions,[data-view-name="feed-action-bar"],[data-view-name="feed-social-actions"]';
  const linkedInReaction = '[data-view-name="feed-like-button"],[data-view-name="feed-reaction-button"],:is(button,[role="button"]):is([aria-label^="Like" i],[aria-label^="React" i])';
  const linkedInReply = '[data-view-name="feed-comment-button"],:is(button,[role="button"])[aria-label^="Comment" i]';
  const linkedInMedia = 'img,video,iframe,canvas,[data-view-name^="feed-image"],[data-view-name^="feed-video"],[data-view-name^="feed-document"]';
  const linkedInBoundary = 'main,[role="main"],[role="feed"],[role="list"],ul,ol,body,html,aside,nav,form';
  const linkedInItemBoundary = '.occludable-update,.main-feed-activity-card,[role="listitem"],[data-activity-urn]';

  function actionCount(card, selector) {
    return [...card.querySelectorAll(selector)].filter((control) => !control.closest(linkedInComment)).length;
  }

  function hasPostActions(card) {
    const bars = actionCount(card, linkedInActions);
    return bars > 0
      ? bars === 1
      : actionCount(card, linkedInReaction) === 1 && actionCount(card, linkedInReply) === 1;
  }

  function hasAttachment(card) {
    for (const media of card.querySelectorAll(linkedInMedia)) {
      if (media.closest(linkedInComment)) continue;
      if (media.matches('[data-view-name^="feed-image"],[data-view-name^="feed-video"],[data-view-name^="feed-document"]')) return true;
      if (media.getAttribute("src")?.includes("feedshare-")) return true;
      const bounds = media.getBoundingClientRect();
      if (bounds.width >= 120 && bounds.height >= 70) return true;
    }
    return false;
  }

  function isIndependentLinkedInPost(element) {
    if (element.matches(linkedInComment)) return false;
    if (element.matches(linkedInItemBoundary)) return true;
    return hasPostActions(element) && (element.matches(linkedInPost) || element.querySelector(linkedInText + ",p"));
  }

  function resolveLinkedInCard(element, post) {
    if (post?.matches(linkedInComment)) return post;
    const commentary = element.closest(linkedInText);
    const startingPoint = post ?? commentary ?? element;

    for (let card = startingPoint, branch, depth = 0;
      card && depth < 8 && !card.matches(linkedInBoundary);
      branch = card, card = card.parentElement, depth++) {
      // A sibling with its own actions has its own post boundary.
      if (branch && [...card.children].some((child) => child !== branch && isIndependentLinkedInPost(child))) break;
      const isCard = card.matches(linkedInPost) || hasPostActions(card);
      if (isCard && hasAttachment(card)) return card;
    }

    return post ?? commentary;
  }

  const adapters = [
    { id: "x", domains: ["x.com", "twitter.com"], selector: '[data-testid="tweet"],[data-testid="trend"]' },
    { id: "youtube", domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"], selector: [
      "ytd-rich-item-renderer", "ytd-video-renderer", "ytd-compact-video-renderer",
      "ytd-grid-video-renderer", "ytd-playlist-video-renderer", "ytd-playlist-panel-video-renderer",
      "ytd-comment-view-model", "ytd-backstage-post-renderer", "ytd-compact-radio-renderer",
      "ytm-video-with-context-renderer", "ytm-compact-video-renderer", "ytm-comment-renderer",
      "ytm-compact-playlist-renderer", "yt-lockup-view-model", "ytm-shorts-lockup-view-model",
      "ytm-shorts-lockup-view-model-v2", "ytd-reel-item-renderer", "ytd-reel-video-renderer",
      "ytm-reel-video-renderer", "yt-shorts-video-title-view-model", ".ytp-videowall-still",
      ".ytp-ce-video", ".ytp-suggestion-link"
    ].join(",") },
    { id: "instagram", domains: ["instagram.com"], selector: article + ',a:is([href*="/p/"],[href*="/reel/"]):has(img)' },
    { id: "reddit", domains: ["reddit.com"], selector: 'shreddit-post,shreddit-comment,.thing[data-fullname],faceplate-tracker[data-testid="search-post"]' },
    { id: "facebook", domains: ["facebook.com"], selector: article + ',[data-pagelet^="FeedUnit"]:not(:has([role="article"]))' },
    { id: "tiktok", domains: ["tiktok.com"], selector: '[data-e2e="recommend-list-item-container"],[data-e2e="search-card-container"],[data-e2e="comment-item"],' + article },
    { id: "bluesky", domains: ["bsky.app"], selector: [
      '[data-testid^="feedItem-by-"]', '[data-testid^="postThreadItem-by-"]', '[data-testid="postThreadItem"]',
      'a[href*="/profile/"][href*="/post/"]:has([data-testid="postText"])', article
    ].join(",") },
    { id: "linkedin", domains: ["linkedin.com"], selector: [linkedInPost, linkedInComment, linkedInText].join(","),
      resolveCard: resolveLinkedInCard, extraCandidates: linkedInMedia, independent: linkedInComment },
    { id: "threads", domains: ["threads.com", "threads.net"], selector: '[data-pressable-container],' + article }
  ];

  function adapterFor(host) {
    return adapters.find(({ domains }) => domains.some((domain) => host === domain || host.endsWith("." + domain)))
      ?? { id: "other", selector: generic + ",.status,.detailed-status" };
  }

  globalThis.NoSpoilRules = { matches, createMatcher, adapterFor };
})();
