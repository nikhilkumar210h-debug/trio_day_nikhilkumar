/**
 * Cloudflare Worker cron for batched task reminders.
 *
 * Runs every 6 hours via cron trigger.
 * Sends ONE notification per user for all their pending tasks.
 *
 * Wrangler secrets required:
 *   npx wrangler secret put FIREBASE_PROJECT_ID      --config wrangler.task-reminder.toml
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL --config wrangler.task-reminder.toml
 *   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY  --config wrangler.task-reminder.toml
 *   npx wrangler secret put ONESIGNAL_APP_ID         --config wrangler.task-reminder.toml
 *   npx wrangler secret put ONESIGNAL_REST_API_KEY   --config wrangler.task-reminder.toml
 *
 * wrangler.task-reminder.toml triggers: crons every 6 hours
 */

import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

const FIREBASE_PUBLIC_KEYS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PROJECT_ID = "nkm-ind";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const APP_BASE = "https://nkm-ind.web.app";

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createServiceAccountJwt(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  function encode(obj) {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  const headerB64 = encode(header);
  const claimB64 = encode(claimSet);
  const signingInput = `${headerB64}.${claimB64}`;

  const pemBody = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = b64urlDecode(pemBody);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${sigB64}`;
}

let _cachedAccessToken = null;
let _cachedTokenExpiry = 0;

async function getAccessToken(env) {
  const now = Date.now() / 1000;
  if (_cachedAccessToken && _cachedTokenExpiry > now + 60) {
    return _cachedAccessToken;
  }

  const jwt = await createServiceAccountJwt(
    env.FIREBASE_SA_CLIENT_EMAIL,
    env.FIREBASE_SA_PRIVATE_KEY,
  );

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${txt}`);
  }

  const data = await res.json();
  _cachedAccessToken = data.access_token;
  _cachedTokenExpiry = now + (data.expires_in || 3600);
  return _cachedAccessToken;
}

function firestoreBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(Math.round(v)) };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object")
    return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreValue(v) {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v)
    return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields || {});
  if ("timestampValue" in v) return v.timestampValue;
  return null;
}

function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

async function fsGet(projectId, accessToken, path) {
  const url = `${firestoreBase(projectId)}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
  const doc = await res.json();
  return doc.fields ? fromFirestoreFields(doc.fields) : {};
}

async function fsPatch(projectId, accessToken, path, data, updateMask) {
  const maskParams = updateMask
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const url = `${firestoreBase(projectId)}/${path}?${maskParams}`;
  const body = { fields: toFirestoreFields(data) };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore PATCH ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function fsRunQuery(projectId, accessToken, structuredQuery) {
  const url = `${firestoreBase(projectId).replace("/documents", "")}:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  return res.json();
}

function localDateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function istDateKey(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}

function getNotificationDedupKey(uid, type, relatedId) {
  const date = istDateKey();
  return `${uid}_${type}_${relatedId || "daily"}_${date}`;
}

async function checkAndSetDedup(env, dedupKey) {
  const cacheKey = `dedup_${dedupKey}`;
  try {
    const cached = await env.NOTIFICATION_DEDUP_KV?.get(cacheKey);
    if (cached) return false;
    await env.NOTIFICATION_DEDUP_KV?.put(cacheKey, "1", {
      expirationTtl: 86400,
    });
    return true;
  } catch {
    return true;
  }
}

async function sendOneSignalPush(env, subscriptionId, title, body, url) {
  const payload = {
    app_id: env.ONESIGNAL_APP_ID,
    include_subscription_ids: [subscriptionId],
    headings: { en: title },
    contents: { en: body },
    target_channel: "push",
  };
  if (url) payload.url = url;

  const res = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: "Key " + env.ONESIGNAL_REST_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.warn("OneSignal push failed:", txt);
    return false;
  }
  return true;
}

async function createNotificationDoc(
  projectId,
  accessToken,
  uid,
  notification,
) {
  const notifRef = `${firestoreBase(projectId)}/users/${uid}/notifications`;
  const body = { fields: toFirestoreFields(notification) };
  const res = await fetch(notifRef, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function getAllUsersWithPendingTasks(projectId, accessToken) {
  const users = [];
  let pageToken = null;
  const batchSize = 200;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId: "users" }],
        limit: batchSize,
        ...(pageToken
          ? { startAt: { values: [{ referenceValue: pageToken }] } }
          : {}),
      },
    };

    const results = await fsRunQuery(projectId, accessToken, query);
    if (!results.length) break;

    for (const item of results) {
      if (!item.document?.name) continue;
      const userData = item.document.fields
        ? fromFirestoreFields(item.document.fields)
        : {};
      const uid = item.document.name.split("/").pop();

      if (!userData.oneSignalId) continue;

      const tasksQuery = {
        structuredQuery: {
          from: [{ collectionId: "users", allDescendants: false }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "uid" },
                    op: "EQUAL",
                    value: { stringValue: uid },
                  },
                },
              ],
            },
          },
          limit: 1,
        },
      };

      const userDoc = await fsGet(projectId, accessToken, `users/${uid}`);
      if (!userDoc) continue;

      const pendingTasks = await getUserPendingTasks(
        projectId,
        accessToken,
        uid,
      );
      if (pendingTasks.length > 0) {
        users.push({
          uid,
          oneSignalId: userData.oneSignalId,
          name: userData.name || "User",
          pendingTasks,
          settings: userData.notificationSettings || {},
        });
      }
    }

    const lastDoc = results[results.length - 1];
    if (lastDoc.document?.name) {
      pageToken = lastDoc.document.name;
    } else {
      break;
    }
    if (results.length < batchSize) break;
  }

  return users;
}

async function getUserPendingTasks(projectId, accessToken, uid) {
  const pendingTasks = [];
  const taskTypes = ["daily", "weekly", "monthly", "challenge"];

  for (const type of taskTypes) {
    const query = {
      structuredQuery: {
        from: [{ collectionId: "userTasks" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "uid" },
                  op: "EQUAL",
                  value: { stringValue: uid },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "type" },
                  op: "EQUAL",
                  value: { stringValue: type },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "done" },
                  op: "EQUAL",
                  value: { booleanValue: false },
                },
              },
            ],
          },
          limit: 50,
        },
      },
    };

    const results = await fsRunQuery(projectId, accessToken, query);
    for (const item of results) {
      if (!item.document?.fields) continue;
      const taskData = fromFirestoreFields(item.document.fields);
      pendingTasks.push({
        id: item.document.name.split("/").pop(),
        title: taskData.title || "Task",
        type: taskData.type,
        xpReward: taskData.xpReward || 0,
      });
    }
  }

  return pendingTasks;
}

async function processTaskReminders(event, env, ctx) {
  console.log("Task reminder cron tick:", event.cron, Date.now());

  if (
    !env.FIREBASE_PROJECT_ID ||
    !env.FIREBASE_SA_CLIENT_EMAIL ||
    !env.FIREBASE_SA_PRIVATE_KEY
  ) {
    console.error("Missing Firebase secrets");
    return;
  }

  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    console.error("Missing OneSignal secrets");
    return;
  }

  const token = await getAccessToken(env);
  const users = await getAllUsersWithPendingTasks(PROJECT_ID, token);

  let sentCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const { uid, oneSignalId, pendingTasks, settings } = user;

    const taskRemindersEnabled = settings.task_reminder !== false;
    if (!taskRemindersEnabled) {
      skippedCount++;
      continue;
    }

    const dedupKey = getNotificationDedupKey(uid, "task_reminder", null);
    const shouldSend = await checkAndSetDedup(env, dedupKey);
    if (!shouldSend) {
      skippedCount++;
      continue;
    }

    const totalTasks = pendingTasks.length;
    const dailyTasks = pendingTasks.filter((t) => t.type === "daily").length;
    const challengeTasks = pendingTasks.filter(
      (t) => t.type === "challenge",
    ).length;

    let title = "Tasks waiting for you";
    let body = `You have ${totalTasks} pending task${totalTasks > 1 ? "s" : ""}`;
    if (dailyTasks > 0) body += ` (${dailyTasks} daily)`;
    if (challengeTasks > 0)
      body += ` (${challengeTasks} challenge${challengeTasks > 1 ? "s" : ""})`;

    const notification = {
      type: "task_reminder",
      actorUid: uid,
      actorName: "Trio Day",
      title,
      text: body,
      read: false,
      createdAtMs: Date.now(),
      createdAt: new Date().toISOString(),
      pendingCount: totalTasks,
      taskTypes: [...new Set(pendingTasks.map((t) => t.type))],
    };

    await createNotificationDoc(PROJECT_ID, token, uid, notification);

    const url = `${APP_BASE}/tasks.html`;
    await sendOneSignalPush(env, oneSignalId, title, body, url);

    sentCount++;
  }

  console.log(
    `Task reminders: sent=${sentCount}, skipped=${skippedCount}, totalUsers=${users.length}`,
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    return json(
      { ok: true, message: "Task reminder cron worker — runs every 6 hours" },
      200,
      origin,
    );
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(processTaskReminders(event, env, ctx));
  },
};
