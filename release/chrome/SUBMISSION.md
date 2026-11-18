# Publish No Spoil 6 on the Chrome Web Store

## First submission

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) using the Google account you registered. Enable 2-Step Verification and complete the contact and verification fields shown on the **Account** page. Set the trader declaration accurately if the dashboard asks for it.
2. Upload `dist/no-spoil-6-chromium.zip` (v1.1.1). If you already have the v1.1.0 draft open, use its **Package** tab to upload the new ZIP. For a first upload, go to **Items → Add new item**. The updated package includes the padded store icon.
3. Complete **Store listing** using the field-by-field instructions below.
4. On **Privacy**, enter the single purpose and permission explanations below. Select the option for bundled code with no remote code. Disclose website content processing and the optional storage of preferences in the browser sync service. Complete the dashboard’s data-use certifications based on these behaviors. Host the `website/` directory on HTTPS and enter the resulting public `/privacy/` URL. Check that it opens without sign-in.
5. On **Distribution**, select **Public** for a discoverable listing, choose the regions you want, and select the appropriate pricing option. The current build has no payment flow, so it can be submitted as free.
6. On **Test instructions**, paste the reviewer instructions below. Then select **Submit for Review**. If you want to publish manually after approval, turn off automatic publishing in the confirmation dialog. Monitor **Status** and the publisher email. When a staged submission is approved, use **Publish** within 30 days.
7. For later updates, increment the version in `extension/manifest.json`, run `python3 scripts/build.py`, and upload the new ZIP under **Package** on the same store item.

[Account setup](https://developer.chrome.com/docs/webstore/set-up-account/) · [Publishing and review](https://developer.chrome.com/docs/webstore/publish/) · [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/) · [Image requirements](https://developer.chrome.com/docs/webstore/images/)

## Store listing fields

| Dashboard field | What to enter |
| --- | --- |
| Title from package | **No Spoil 6**. Chrome reads it from the manifest. |
| Summary from package | **Hide GTA 6 spoilers with story filters, custom phrases, scheduled blocks, and timed reveals.** Chrome reads it from the manifest. |
| Description | Paste the full contents of [DESCRIPTION.txt](DESCRIPTION.txt). |
| Category | **Social Media & Networking**. The main use is filtering social feeds. |
| Language | **English**. |
| Store icon | [store-icon-128.png](store-icon-128.png), a transparent 128 × 128 PNG with 16 px padding. |
| Screenshots | Upload [01-spoiler-shield.png](01-spoiler-shield.png), [02-filter-settings.png](02-filter-settings.png), and [03-local-schedule.png](03-local-schedule.png) in that order. All are 1280 × 800 RGB PNGs. |
| Small promo tile | [small-promo-440x280.png](small-promo-440x280.png). |
| Marquee promo tile | [marquee-1400x560.png](marquee-1400x560.png). |
| Global promo video | Upload [no-spoil-6-promo.mp4](no-spoil-6-promo.mp4) to YouTube Studio, choose **Unlisted** or **Public**, and paste the video's watch URL. Suggested title is **No Spoil 6 — Keep GTA 6 a surprise**. You can submit the listing with this field empty while the video is pending. |
| Official URL | Select your website from the dropdown after verifying ownership through Google Search Console. Leave it blank until verified. |
| Homepage URL | Enter the public HTTPS URL of the hosted No Spoil 6 homepage. |
| Support URL | Enter the public HTTPS URL of the hosted `/support/` page. |
| Mature content | **Off** for the extension and listing assets provided here. |
| Item support | In **Account → Item support**, turn **Visibility** on so users can report issues through the Chrome Web Store. |

Only the icon and at least one screenshot are required graphics. The promo tiles and YouTube video are optional. You can use the local [website folder](../../website/) to publish the homepage, support page, and privacy policy on your HTTPS host.

[Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/) · [Categories](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well) · [Item support](https://developer.chrome.com/docs/webstore/support-users#the-support-hub) · [Content ratings](https://developer.chrome.com/docs/webstore/rating) · [YouTube upload](https://support.google.com/youtube/answer/57407)

## Privacy and permission explanations

**Single purpose**  
Hide spoilers in the browser by covering matching content and website sections according to the user’s filters and schedule.

**Website access**  
No Spoil 6 uses HTTP and HTTPS page access to recognize and cover matching posts and user-selected website sections across domains. It evaluates page text, titles, links, and image descriptions on the device. It applies the user’s platform switches, URL blocks, and local schedules.

**Storage**  
Storage remembers local filters, scheduling, lock state, and daily activity totals. Activity totals contain no page titles, post text, or URLs. With explicit opt-in, the browser’s sync service can store filter preferences, phrases, site blocks, and schedules. The extension has no developer server and sends no page content or activity to any service.

## Reviewer instructions

No account or credentials are required to test. Install the extension and open (or reload) a supported website. Search for a GTA 6 trailer on YouTube. Matching video results display a reveal button by default. Use the eye button to reveal one result. It is covered again after 15 seconds by default.

Open the toolbar popup to change the filter or schedule. Select **Settings** to add a phrase, turn a platform on or off, or add a temporary site block such as `example.com`. Visiting that page shows the extension’s block screen, and removing the rule restores the page. The **Activity** panel shows daily totals. **Backup & sync** has file import and export and an optional browser-sync control.
