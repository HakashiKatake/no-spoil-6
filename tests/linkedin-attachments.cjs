// Run scripts/build.py first. Requires Playwright and its Chromium browser.
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const cover = "[data-no-spoil-covered]";
const control = "[data-no-spoil-control]";
const image = '<img width="410" height="150" alt="Post attachment" style="display:block;background:royalblue">';
const actions = '<footer><button aria-label="Like">Like</button><button aria-label="Comment">Comment</button></footer>';
const first = `
  <main>
    <div id="card" componentkey="expandedurn:li:activity:101">
      <div data-view-name="feed-full-update"><p id="copy">GTA 6 trailer discussion</p></div>
      <div id="attachment" data-view-name="feed-image-gallery">${image}</div>
      ${actions}
    </div>
    <div id="other" componentkey="expandedurn:li:activity:102">
      <div data-view-name="feed-full-update"><p>Office setup discussion</p></div>
      <div id="other-attachment">${image}</div>
      ${actions}
    </div>
  </main>`;

const late = `
  <main>
    <div id="card">
      <div><p id="copy">GTA 6 trailer discussion</p></div>
      <div id="attachment"></div>
      ${actions}
    </div>
    <div id="other">
      <div data-view-name="feed-commentary"><p>Office setup discussion</p></div>
      <div id="other-attachment">${image}</div>
      ${actions}
    </div>
  </main>`;

const adjacent = `
  <main><div id="list">
    <div id="card"><p id="copy">GTA 6 trailer discussion</p>${actions}</div>
    <div id="other"><p>Office setup discussion</p><div id="other-attachment">${image}</div>${actions}</div>
  </div></main>`;

async function run() {
  const profile = await mkdtemp(path.join(tmpdir(), "no-spoil-linkedin-"));
  const extension = path.resolve(process.env.EXTENSION_DIR ?? path.join(__dirname, "../dist/chromium"));
  const executablePath = process.env.BROWSER_EXECUTABLE;
  let browser;
  try {
    browser = await chromium.launchPersistentContext(profile, {
      channel: executablePath ? undefined : "chromium",
      executablePath,
      headless: true,
      args: ["--disable-extensions-except=" + extension, "--load-extension=" + extension]
    });
    const pages = { "/feed/late": late, "/feed/adjacent": adjacent };
    await browser.route("https://www.linkedin.com/feed/**", (route) => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>main{width:460px;padding:20px}#card,#other{display:block;margin-bottom:20px}</style>'
        + (pages[new URL(route.request().url()).pathname] ?? first)
    }));
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const card = page.locator("#card");
    const attachment = page.locator("#attachment img");
    const isCovered = () => page.locator("#card" + cover).waitFor({ state: "attached" });

    await page.goto("https://www.linkedin.com/feed/foryou/");
    await isCovered();
    assert.equal(await attachment.evaluate((element) => getComputedStyle(element).opacity), "0");
    assert.equal(await page.locator("#other-attachment img").evaluate((element) => getComputedStyle(element).opacity), "1");
    assert.equal(await card.locator(cover).count(), 0, "one shield covers the entire post");

    const box = await card.locator(":scope > " + control).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 26);
    await page.locator("#card" + cover).waitFor({ state: "detached" });
    assert.equal(await attachment.evaluate((element) => getComputedStyle(element).opacity), "1");

    await page.goto("https://www.linkedin.com/feed/late");
    await page.locator("#copy" + cover).waitFor({ state: "attached" });
    await page.locator("#attachment").evaluate((element, markup) => element.insertAdjacentHTML("beforeend", markup), image);
    await isCovered();
    assert.equal(await attachment.evaluate((element) => getComputedStyle(element).opacity), "0");
    assert.equal(await page.locator("#copy" + cover).count(), 0, "the full card takes over when the image loads");
    assert.equal(await page.locator("#other-attachment img").evaluate((element) => getComputedStyle(element).opacity), "1");

    await page.goto("https://www.linkedin.com/feed/adjacent");
    await page.locator("#copy" + cover).waitFor({ state: "attached" });
    assert.equal(await page.locator("#list" + cover).count(), 0, "the adjacent post starts a new card");
    assert.equal(await page.locator("#other-attachment img").evaluate((element) => getComputedStyle(element).opacity), "1");
  } finally {
    await browser?.close();
    await rm(profile, { recursive: true, force: true });
  }
}

run().then(() => console.log("LinkedIn attachment regression checks passed."), (error) => {
  console.error(error);
  process.exitCode = 1;
});
