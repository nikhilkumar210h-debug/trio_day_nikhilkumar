import { auth } from "../firebase-init.js";

const API_BASE_URL = String(
  window.TRIO_API_BASE_URL ||
  (location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "http://127.0.0.1:5000" : "")
).replace(/\/$/, "");

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function createNotificationViaWorker(targetUid, data) {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");
  if (!API_BASE_URL) throw new Error("Trio Day API URL is not configured");

  const res = await fetch(API_BASE_URL + "/api/notifications/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ targetUid, ...data }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Notification API failed");
  }

  return res.json();
}

export async function notifyUserViaWorker(targetUid, data) {
  return createNotificationViaWorker(targetUid, data);
}

export function getNotificationWorkerStatus() {
  return {
    url: API_BASE_URL ? API_BASE_URL + "/api/notifications/create" : null,
    available: Boolean(API_BASE_URL),
  };
}
