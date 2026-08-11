// Built-in patterns shipped with the extension.
// Each can be toggled on/off individually from the popup.
// delayMs: optional extra grace period before closing. Every close already
// waits ~1.2s and re-verifies the tab's final URL (so transient redirect
// hops never trigger a close); delayMs raises that wait when a page needs
// longer (e.g. the Zoom protocol-handler dialog).
const DEFAULT_PATTERNS = [
  {
    id: "cloudflare-access-refresh",
    label: "Cloudflare Access identity refresh",
    value: "https://*.cloudflareaccess.com/cdn-cgi/access/refresh-identity?success=true*",
    isRegex: false,
    delayMs: 0
  },
  {
    id: "zoom-launch-success",
    label: "Zoom launch leftover (#success)",
    value: "https://*.zoom.us/*#success",
    isRegex: false,
    delayMs: 2000
  }
];

// Make available to the service worker via importScripts and to the popup
// via a plain <script> tag.
if (typeof self !== "undefined") {
  self.DEFAULT_PATTERNS = DEFAULT_PATTERNS;
}
