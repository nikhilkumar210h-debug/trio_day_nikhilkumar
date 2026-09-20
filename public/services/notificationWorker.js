import { auth } from "../firebase-init.js";
import { trioCache } from "../trio-cache.js";

const NOTIFICATION_WORKER_URL =
  "https://trio-notifications.trioday-nikhil.workers.dev/notifications/create";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function createNotificationViaWorker(targetUid, data) {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const res = await fetch(NOTIFICATION_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUid, ...data }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error || "Notification Worker failed";
      throw new Error(message);
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

export async function notifyUserViaWorker(targetUid, data) {
  return createNotificationViaWorker(targetUid, data);
}

export function getNotificationWorkerStatus() {
  return {
    url: NOTIFICATION_WORKER_URL,
    available: true,
  };
}
