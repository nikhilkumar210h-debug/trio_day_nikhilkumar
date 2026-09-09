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
  if (!token) {
    console.warn("No auth token, falling back to direct write");
    return { fallback: true };
  }

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
      console.warn("Worker notification failed:", err);
      return { fallback: true, error: err.error };
    }

    return await res.json();
  } catch (err) {
    console.warn("Worker notification request failed:", err);
    return { fallback: true, error: err.message };
  }
}

export async function notifyUserViaWorker(targetUid, data) {
  const result = await createNotificationViaWorker(targetUid, data);

  if (result.fallback) {
    const { notifyUser } = await import("./notificationHelpers.js");
    await notifyUser(targetUid, data);
  }

  return result;
}

export function getNotificationWorkerStatus() {
  return {
    url: NOTIFICATION_WORKER_URL,
    available: true,
  };
}
