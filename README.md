# No Spoil 6

A browser extension that blurs posts mentioning GTA 6, including ordinary news, trailers and discussion. The eye button reveals that post. Use it again to cover the post.

## Load the extension

The ZIP files in `dist/` contain the extension files. Extract the ZIP for your browser before loading it.

| Browser | Local installation |
| --- | --- |
| Chrome, Edge, Brave, Opera and Vivaldi | Open the browser’s extensions manager, enable Developer mode, choose **Load unpacked** and select `dist/chromium`. In Chrome the manager is at `chrome://extensions`. |
| Firefox desktop 140+ | Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Firefox removes temporary add-ons when restarted. |
| Safari on Mac 16.4+ | In **Safari → Settings → Advanced**, enable **Show features for web developers**. In **Developer**, use **Add Temporary Extension** if available and select `dist/safari`. Grant website access in Safari. On versions without the temporary loader, use Apple’s Safari Web Extension Packager. |

The extension starts in **Always on** mode. Refresh tabs that were already open after loading it, then open the toolbar popup for controls. In **Schedule**, choose a local start date and time, add daily browsing windows, or combine the two. A window like `22:00–02:00` continues past midnight. **Paused** shows the feed normally until you change modes.

Use **Settings** in the popup to choose everything, story and leaks, or custom phrases only. Add phrases that always match, require a topic cue, or keep a post visible. Set per-platform switches, timed reveals, and tab-title protection under Filters. A site block covers a whole host or a path in the browser, with optional daily hours. The shield lock prevents changes and post reveals inside the extension until the chosen time, with an early-unlock cooldown. Activity shows local counts and a no-reveal streak. Export/import and opt-in browser sync carry preferences between browser installations.

## Build and distribute

Run `python3 scripts/build.py` to rebuild the unpacked folders and ZIPs. The extension has no runtime dependencies or developer backend. Its JavaScript and fonts are bundled. Page content and activity counts stay on the device. Preferences are local by default and can be synced through your browser if you opt in.

For Chrome Web Store submission, see the [release checklist](release/chrome/SUBMISSION.md).

Store publishing uses the relevant Chromium store and [Firefox Add-ons](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/). The [Safari packager](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) wraps the Safari bundle for macOS and iOS. With Xcode installed, run `xcrun safari-web-extension-packager --app-name "No Spoil 6" --copy-resources --project-location ./dist/safari-project ./dist/safari`. Apple also provides [packaging through App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect).

## Coverage

The shield checks post text, accessible image descriptions, titles and links. It has dedicated rules for X, YouTube, Instagram, Reddit, Facebook, TikTok, Bluesky, LinkedIn and Threads, with shared rules for Mastodon and other websites. The generic filter works best on websites with identifiable posts, headlines or captions. A photo, video or audio clip with no matching text or metadata can slip through. Native social apps and browser-protected pages are outside its reach.

## Website

GitHub Actions rebuilds the browser downloads and publishes the `website/` folder to [GitHub Pages](https://hakashikatake.github.io/no-spoil-6/) when site or extension files change on `main`. Use the live [privacy policy](https://hakashikatake.github.io/no-spoil-6/privacy/) and [support page](https://hakashikatake.github.io/no-spoil-6/support/) in the store forms.

For a local preview, run `python3 -m http.server 8000 --directory website` from the project root and open `http://localhost:8000`.

<details>
<summary>Hero artwork</summary>

The built-in ImageGen tool created `website/assets/after-dark.webp` using this prompt.

> Create a widescreen cinematic editorial photograph for the background of No Spoil 6, a browser extension landing page. A real South Florida coastal city in violet blue hour, seen at street level on a wet Art Deco boulevard. Wide 2.4:1 composition. Keep the left 54 percent very dark and quiet, almost black plum with subtle grain and fog, suitable for overlaid white text. Concentrate tall silhouetted palm trees, a dusty magenta dusk sky, distant pink and amber Art Deco neon accents (no signs or readable text), and reflective black pavement on the right half. A few soft distant car lights only. Cinematic 35mm film, realistic urban textures, warm dusk glow against cool violet shadows, restrained color, elegant and moody. Dim lower edge so it can blend into a black page. No people in foreground, no logos, no lettering, no interface or overlays, no game characters or imagery.

</details>
