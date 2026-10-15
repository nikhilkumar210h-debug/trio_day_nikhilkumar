import { auth } from "../firebase-init.js";

/**
 * Notification creation is routed exclusively through the Cloudflare Worker
 * (workers/send-notification.js, deployed as "trio-notifications" — see
 * workers/wrangler.notifications.toml). The legacy Python/Flask API
 * (127.0.0.1:5000 / trio-day-api.onrender.com) is retired.
 */
const NOTIFICATION_WORKER_URL = String(
  window.TRIO_NOTIFICATIONS_WORKER_URL ||
  "https://trio-notifications.trioday-nikhil.workers.dev"
).replace(/\/$/, "");

const CREATE_ENDPOINT = "/notifications/create";

// Local dev (Live Server / 127.0.0.1:5500) has no deployed notifications
// worker to talk to — attempting the fetch would only produce console
// network errors. Skip silently unless an explicit worker URL is provided
// (set window.TRIO_NOTIFICATIONS_WORKER_URL to test against a real worker).
const IS_LOCAL_DEV =
  ["localhost", "127.0.0.1", ""].includes(location.hostname) ||
  location.protocol === "file:";
const HAS_EXPLICIT_WORKER_URL = Boolean(window.TRIO_NOTIFICATIONS_WORKER_URL);

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Best-effort notification creation via the Cloudflare Worker.
 * Never throws: offline / local / unreachable / rejected requests resolve
 * silently so fire-and-forget callers never produce console errors.
 */
export async function createNotificationViaWorker(targetUid, data) {
  try {
    if (!targetUid) return { ok: false, skipped: "missing-target" };
    if (IS_LOCAL_DEV && !HAS_EXPLICIT_WORKER_URL) {
      return { ok: false, skipped: "local-dev" };
    }
    const token = await getIdToken();
    if (!token) return { ok: false, skipped: "not-authenticated" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, skipped: "offline" };
    }

    const res = await fetch(NOTIFICATION_WORKER_URL + CREATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ targetUid, ...data }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || "Notification API failed" };
    }

    return res.json();
  } catch (_) {
    // Offline / local fallback — notifications are best-effort only.
    return { ok: false, skipped: "unavailable" };
  }
}

export async function notifyUserViaWorker(targetUid, data) {
  return createNotificationViaWorker(targetUid, data);
}

export function getNotificationWorkerStatus() {
  if (IS_LOCAL_DEV && !HAS_EXPLICIT_WORKER_URL) {
    return { url: null, available: false, reason: "local-dev" };
  }
  return {
    url: NOTIFICATION_WORKER_URL + CREATE_ENDPOINT,
    available:
      Boolean(NOTIFICATION_WORKER_URL) &&
      (typeof navigator === "undefined" || navigator.onLine !== false),
  };
}
