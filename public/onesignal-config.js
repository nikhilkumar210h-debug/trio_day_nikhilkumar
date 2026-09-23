// Public OneSignal config only. REST API Key stays in Worker secrets / .env.
export const ONESIGNAL_APP_ID = "ae462d86-13fe-48d1-a577-a484f539f4cb";
export const PUSH_API_URL = "https://trio-onesignal-push.trioday-nikhil.workers.dev";
export const APP_BASE = "https://trio-day.trioday-nikhil.workers.dev";

/** App base path — Trio Day is served from the current web app root. */
export function siteBasePath() {
  return "/";
}
