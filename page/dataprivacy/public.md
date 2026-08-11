# Tab Sweeper — Data Privacy

_Last updated: 2026-08-11_

## Summary

Tab Sweeper is a browser extension that automatically closes tabs whose URL
matches a set of patterns — built-in patterns (e.g. Cloudflare Access identity
refresh pages, Zoom launch leftovers) and patterns you define yourself.

**Tab Sweeper collects, transmits, sells, or shares absolutely no personal
data.** All processing happens locally inside your browser. The extension makes
no network requests of its own, contains no analytics or telemetry, and no data
ever leaves your device.

## What the extension does

- Watches tab URLs and closes tabs that match an enabled pattern.
- Lets you define your own glob or regular-expression patterns.
- Shows a counter of how many tabs it has closed for you.

## Permissions and why they are needed

| Permission | Why it is needed | How it is used |
|---|---|---|
| `tabs` | To read a tab's URL and to close matching tabs. | The URL is compared **in memory, on your device** against your patterns. URLs are never stored in a list, logged, or sent anywhere. |
| `webNavigation` | To detect same-document navigations (hash changes like Zoom's `#success`, and `history.pushState`) that the `tabs` events do not report. | The reported URL is matched against your patterns locally, exactly as above. |
| `storage` | To save your settings and the closed-tab counter. | See "Data stored on your device" below. |

The extension has **no content scripts** and never reads page content, form
data, cookies, or credentials. It only ever looks at URLs.

## Data stored on your device

| Data | Storage area | Contents |
|---|---|---|
| Settings | `chrome.storage.sync` | On/off switch, "skip pinned tabs" option, your custom patterns (pattern text, glob/regex flag, optional delay), and per-default-pattern toggles. |
| Closed-tab counter | `chrome.storage.local` | A single number: how many tabs Tab Sweeper has closed. No URLs, no timestamps, no history. |

- `chrome.storage.sync` data may be synchronized between your own browser
  installations by your **browser vendor's sync service** (e.g. Chrome Sync)
  if you have sync enabled. This is governed by your browser vendor's privacy
  policy — the extension developer has no access to it.
- All stored data lives only in your browser profile and is **permanently
  deleted when you uninstall the extension**.

## What Tab Sweeper does NOT do

- No collection of browsing history or URLs.
- No analytics, tracking, fingerprinting, or telemetry of any kind.
- No network requests to the developer or any third party.
- No advertising, no data sale, no data sharing with anyone.
- No remote code execution — all code ships inside the extension package.
- No accounts, no sign-up, no cookies.

## Third parties

None. The built-in patterns reference third-party services (Cloudflare Access,
Zoom) **only as URL patterns used to close leftover tabs**. Tab Sweeper is not
affiliated with these services and exchanges no data with them.

## Changes to this policy

Any change to this policy will be published on this page and shipped with a
new extension release.

## Contact

Questions or concerns about privacy? Please open an issue on the project's
GitHub repository.
