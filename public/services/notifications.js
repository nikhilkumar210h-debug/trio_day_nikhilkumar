// Trio Day — Notification Services (merged)
// Combines: notificationHelpers.js, notificationWorker.js, notificationSettings.js
// Single source for all notification-related logic: create, send, settings, UI rendering.

import { auth, db } from "../firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { trioCache } from "../trio-cache.js";
import { SoundManager } from "../sound-manager.js";
import { APP_BASE } from "../onesignal-config.js";

// ──────────────────────────────────────────────────────────────────────────────
// Notification Worker Client (was notificationWorker.js)
// Routes notification creation exclusively through the Cloudflare Worker.
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// Notification Helpers (was notificationHelpers.js)
// Shared notification helpers for Story, Challenge, Chat and connection flows.
// ──────────────────────────────────────────────────────────────────────────────

export async function notifyUser(targetUid, data) {
  if (!targetUid) return;
  return createNotificationViaWorker(targetUid, data);
}

export function pushCopy({ type, actorName, text, title }) {
  const who = actorName || "Someone";
  const map = {
    like: { title: "New like", body: `${who} liked your story` },
    comment: { title: "New comment", body: `${who} commented on your story` },
    share: { title: "Story shared", body: `${who} shared your story` },
    connect: { title: "New connection", body: `${who} connected with you` },
    message: { title: "New message", body: `${who}: ${text || "New message"}` },
    badge_earned: {
      title: title || "Badge unlocked!",
      body: text || "You earned a new badge",
    },
    challenge_reminder: {
      title: title || "Challenge reminder",
      body: text || "A challenge is waiting for you",
    },
  };
  return map[type] || { title: title || "Trio Day", body: text || `${who} sent you an update` };
}

export function pushUrl({ type, actorUid, postId, urlPath }) {
  if (urlPath) return `${APP_BASE}/${String(urlPath).replace(/^\//, "")}`;
  if (type === "message")
    return `${APP_BASE}/chat.html?uid=${encodeURIComponent(actorUid || "")}`;
  if (type === "connect") {
    return actorUid
      ? `${APP_BASE}/profile.html?uid=${encodeURIComponent(actorUid)}`
      : `${APP_BASE}/search.html`;
  }
  if (type === "challenge_reminder") return `${APP_BASE}/index.html`;
  if (type === "badge_earned") return `${APP_BASE}/profile.html`;
  // postId is retained as the legacy story identifier in existing notifications.
  // Stories are now opened from Today, never through the retired Post viewer.
  if (postId) return `${APP_BASE}/index.html`;
  return `${APP_BASE}/index.html`;
}

export function notificationText(notification) {
  const who = notification.actorName || "Someone";
  if (notification.title && ["badge_earned", "challenge_reminder"].includes(notification.type)) {
    return notification.title + (notification.text ? ` — ${notification.text}` : "");
  }
  return {
    like: `${who} liked your story`,
    comment: `${who} commented on your story`,
    share: `${who} shared your story`,
    connect: `${who} connected with you`,
    message: `${who}: ${notification.text || "New message"}`,
    badge_earned: notification.title || "New badge unlocked!",
    challenge_reminder: notification.title || "Challenge reminder",
  }[notification.type] || `${who} sent you an update`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Notification Settings (was notificationSettings.js)
// User notification preferences management.
// ──────────────────────────────────────────────────────────────────────────────

const SETTING_KEYS = [
  { key: "like", label: "Likes", desc: "When someone reacts to your story" },
  { key: "comment", label: "Comments", desc: "When someone comments on your story" },
  { key: "share", label: "Shares", desc: "When someone shares your story" },
  { key: "connect", label: "Connections", desc: "When someone connects with you" },
  { key: "message", label: "Messages", desc: "When you receive a private message" },
  { key: "badge_earned", label: "Badges", desc: "When you earn a Challenge badge" },
  { key: "challenge_reminder", label: "Challenge Reminders", desc: "Reminders for active or ending Challenges" },
];

export async function loadNotificationSettings(uid) {
  const cacheKey = `user_${uid}`;
  const cached = trioCache.get(cacheKey);
  if (cached?.notificationSettings) return cached.notificationSettings;

  const snap = await getDoc(doc(db, "users", uid)).catch(() => null);
  if (snap?.exists()) {
    const data = snap.data();
    return data.notificationSettings || getDefaultSettings();
  }
  return getDefaultSettings();
}

function getDefaultSettings() {
  const settings = { pushEnabled: true };
  for (const s of SETTING_KEYS) {
    settings[s.key] = true;
  }
  return settings;
}

export function renderNotificationSettings(container, settings, onChange) {
  container.innerHTML = "";

  const pushRow = document.createElement("div");
  pushRow.className = "nkm-setting-row";
  pushRow.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--color-border)";
  pushRow.innerHTML = `
    <div>
      <div style="font-weight:500">Push Notifications</div>
      <div style="font-size:12px;color:var(--ink-muted)">Master switch for all push notifications</div>
    </div>
    <label class="nkm-toggle" style="margin-left:12px">
      <input type="checkbox" ${settings.pushEnabled ? "checked" : ""} data-setting="pushEnabled">
      <span class="nkm-toggle-slider"></span>
    </label>
  `;
  container.appendChild(pushRow);

  for (const setting of SETTING_KEYS) {
    const row = document.createElement("div");
    row.className = "nkm-setting-row";
    row.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--color-border)";
    const enabled = settings[setting.key] !== false;
    row.innerHTML = `
      <div>
        <div style="font-weight:500">${setting.label}</div>
        <div style="font-size:12px;color:var(--ink-muted)">${setting.desc}</div>
      </div>
      <label class="nkm-toggle" style="margin-left:12px">
        <input type="checkbox" ${enabled ? "checked" : ""} data-setting="${setting.key}" ${!settings.pushEnabled ? "disabled" : ""}>
        <span class="nkm-toggle-slider"></span>
      </label>
    `;
    container.appendChild(row);
  }

  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", async (e) => {
      const key = e.target.dataset.setting;
      const value = e.target.checked;
      await onChange(key, value);
    });
  });
}

export async function saveNotificationSetting(uid, key, value) {
  const settings = await loadNotificationSettings(uid);
  settings[key] = value;
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { notificationSettings: settings });
  trioCache.invalidate(`user_${uid}`);
  try {
    SoundManager.click();
  } catch {}
}

export async function initNotificationSettingsUI(uid, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const settings = await loadNotificationSettings(uid);

  renderNotificationSettings(container, settings, async (key, value) => {
    await saveNotificationSetting(uid, key, value);

    if (key === "pushEnabled") {
      const inputs = container.querySelectorAll(
        'input[data-setting]:not([data-setting="pushEnabled"])',
      );
      inputs.forEach((input) => {
        input.disabled = !value;
        if (!value) input.checked = false;
      });
    }
  });
}
