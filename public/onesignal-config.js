// Public OneSignal config only. REST API Key stays in Worker secrets / .env.
export const ONESIGNAL_APP_ID = "ae462d86-13fe-48d1-a577-a484f539f4cb";
export const PUSH_API_URL = "https://trio-onesignal-push.trioday-nikhil.workers.dev";
export const APP_BASE = "https://nkm-ind.web.app";

/** App base path — Firebase Hosting serves from "/" (nkm-ind.web.app). Legacy GH Pages prefix kept only as fallback for old indexed links. */
export function siteBasePath() {
  const path = location.pathname || "/";
  // Legacy fallback: old GitHub Pages URL https://nikhilkumar210h-debug.github.io/trio_day_nikhilkumar/ — no longer active, kept so old shared links still resolve if migrated
  if (path === "/trio_day_nikhilkumar" || path.startsWith("/trio_day_nikhilkumar/")) {
    return "/trio_day_nikhilkumar/";
  }
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "/";
  if (!parts[parts.length - 1].includes(".")) {
    return `/${parts.join("/")}/`;
  }
  if (parts.length > 1) {
    return `/${parts.slice(0, -1).join("/")}/`;
  }
  return "/";
}
