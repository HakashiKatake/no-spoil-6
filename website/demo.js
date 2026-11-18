(() => {
  const feeds = {
    x: {
      label: "X",
      clean: ["Coastline Coffee", "@coastlinecoffee", "CC", "First iced coffee of the day. The second is already on the way."],
      spoiler: ["Night Drive Files", "@nightdrivefiles", "NF", "GTA 6 trailer discussion. Here’s what caught my eye."]
    },
    youtube: {
      label: "YouTube",
      clean: ["Dusk Radio", "Video", "DR", "An hour of ambient jazz for late-night drives."],
      spoiler: ["Game Frame", "Video", "GF", "Grand Theft Auto VI trailer breakdown and discussion."]
    },
    instagram: {
      label: "Instagram",
      clean: ["City at Dusk", "@cityatdusk", "CD", "That little stretch of blue hour before the streetlights come on."],
      spoiler: ["Coastal Clips", "@coastalclips", "CC", "A reel about the latest GTA 6 trailer."]
    },
    reddit: {
      label: "Reddit",
      clean: ["r/photography", "Discussion", "r/", "What’s your favorite lens for shooting at night?"],
      spoiler: ["r/GTA6", "Discussion", "r/", "A thread to talk about the Grand Theft Auto VI trailer."]
    }
  };

  const platforms = [...document.querySelectorAll("[data-platform]")];
  const toggle = document.querySelector("#shield-switch");
  const post = document.querySelector("#spoiler-post");
  const body = document.querySelector("#spoiler-body");
  const coveredLabel = document.querySelector("#covered-label");
  const reveal = document.querySelector("#reveal-post");
  const status = document.querySelector("#demo-status");

  let shieldOn = true;
  let revealed = false;

  function writePost(type, postContent) {
    const fields = ["author", "handle", "avatar", "copy"];
    fields.forEach((field, index) => {
      document.getElementById(type + "-" + field).textContent = postContent[index];
    });
  }

  function updatePost() {
    const covered = shieldOn && !revealed;
    post.classList.toggle("is-covered", covered);
    body.inert = covered;
    if (covered) body.setAttribute("aria-hidden", "true");
    else body.removeAttribute("aria-hidden");

    toggle.setAttribute("aria-pressed", String(shieldOn));
    toggle.querySelector("span").textContent = shieldOn ? "Shield on" : "Shield off";
    coveredLabel.hidden = !covered;
    reveal.hidden = !shieldOn;
    reveal.setAttribute("aria-expanded", String(!covered));
    reveal.querySelector("span").textContent = covered ? "Reveal post" : "Cover post";
  }

  for (const platform of platforms) {
    platform.addEventListener("click", () => {
      if (platform.getAttribute("aria-pressed") === "true") return;
      const feed = feeds[platform.dataset.platform];
      platforms.forEach((button) => button.setAttribute("aria-pressed", String(button === platform)));
      writePost("ordinary", feed.clean);
      writePost("spoiler", feed.spoiler);
      revealed = false;
      updatePost();
      status.textContent = feed.label + (shieldOn ? " preview. GTA 6 post covered." : " preview. Shield off.");
    });
  }

  toggle.addEventListener("click", () => {
    shieldOn = !shieldOn;
    revealed = false;
    updatePost();
    status.textContent = shieldOn ? "Shield on. GTA 6 post covered." : "Shield off. Both sample posts are visible.";
  });

  reveal.addEventListener("click", () => {
    revealed = !revealed;
    updatePost();
    status.textContent = revealed ? "Sample post revealed." : "Sample post covered again.";
  });
})();
