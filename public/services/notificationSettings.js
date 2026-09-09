import { auth, db } from "../firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { trioCache } from "../trio-cache.js";
import { SoundManager } from "../sound-manager.js";

const SETTING_KEYS = [
  { key: "like", label: "Likes", desc: "When someone likes your post" },
  {
    key: "comment",
    label: "Comments",
    desc: "When someone comments on your post",
  },
  { key: "share", label: "Shares", desc: "When someone shares your post" },
  {
    key: "connect",
    label: "Connections",
    desc: "When someone connects with you",
  },
  {
    key: "message",
    label: "Messages",
    desc: "When you receive a private message",
  },
  { key: "badge_earned", label: "Badges", desc: "When you earn a new badge" },
  {
    key: "task_reminder",
    label: "Task Reminders",
    desc: "Daily task reminders (sent every 6 hours)",
  },
  {
    key: "challenge_reminder",
    label: "Challenge Reminders",
    desc: "Reminders for ending challenges",
  },
  {
    key: "streak_warning",
    label: "Streak Warnings",
    desc: "Alert when your streak is at risk",
  },
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
    "display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--nkm-border,rgba(148,163,184,.1))";
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
      "display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--nkm-border,rgba(148,163,184,.1))";
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
