/**
 * Cloudflare Worker — Server-authoritative notification creation.
 *
 * Clients call this instead of writing directly to Firestore.
 * Worker verifies the action exists, then creates notification with service account.
 *
 * Endpoints:
 *   POST /notifications/create
 *
 * Wrangler secrets required:
 *   npx wrangler secret put FIREBASE_PROJECT_ID      --config wrangler.notifications.toml
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL --config wrangler.notifications.toml
 *   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY  --config wrangler.notifications.toml
 *   npx wrangler secret put ONESIGNAL_APP_ID         --config wrangler.notifications.toml
 *   npx wrangler secret put ONESIGNAL_REST_API_KEY   --config wrangler.notifications.toml
 */

import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

const FIREBASE_PUBLIC_KEYS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PROJECT_ID = "nkm-ind";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const APP_BASE = "https://nkm-ind.web.app";

const ALLOWED_NOTIFICATION_TYPES = [
  "like",
  "comment",
  "share",
  "connect",
  "message",
  "badge_earned",
  "task_reminder",
  "challenge_reminder",
  "streak_warning",
  "task_complete",
];

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

async function verifyFirebaseIdToken(token, projectId, cacheStorage) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (_) {
    throw new Error("Token decode failed");
  }

  if (header.alg !== "RS256") throw new Error("Unsupported algorithm");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error("Token expired");
  if (payload.iat > now + 60) throw new Error("Token issued in future");
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("Token issuer mismatch");
  if (!payload.sub) throw new Error("Missing subject");

  const cacheKey = "https://firebase-pubkeys.internal/v1";
  try {
    const cached = await cacheStorage.match(cacheKey);
    if (cached) {
      const keys = await cached.json();
      const publicKey = keys[header.kid];
      if (!publicKey) throw new Error("Unknown key id");

      const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const signature = b64urlDecode(parts[2]);

      const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        signature,
        signingInput,
      );
      if (!valid) throw new Error("Token signature invalid");
      return payload;
    }
  } catch (_) {
    /* ignore cache errors */
  }

  const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  const certMap = await res.json();

  const result = {};
  for (const [kid, pem] of Object.entries(certMap)) {
    try {
      const pemBody = pem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s/g, "");
      const derBytes = b64urlDecode(pemBody);

      const cryptoKey = await crypto.subtle.importKey(
        "spki",
        extractPublicKeyFromCert(derBytes),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      result[kid] = cryptoKey;
    } catch (_) {
      /* skip invalid keys */
    }
  }

  const response = new Response(JSON.stringify(result), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
  await cacheStorage.put(cacheKey, response);

  const publicKey = result[header.kid];
  if (!publicKey) throw new Error("Unknown key id");

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signingInput,
  );
  if (!valid) throw new Error("Token signature invalid");

  return payload;
}

function extractPublicKeyFromCert(derBytes) {
  let offset = 0;

  function readTag(buf, off) {
    return { tag: buf[off], next: off + 1 };
  }

  function readLength(buf, off) {
    if (buf[off] < 0x80) return { len: buf[off], next: off + 1 };
    const numBytes = buf[off] & 0x7f;
    let len = 0;
    for (let i = 0; i < numBytes; i++) len = (len << 8) | buf[off + 1 + i];
    return { len, next: off + 1 + numBytes };
  }

  function skipField(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { len, next: afterLen } = readLength(buf, afterTag);
    return afterLen + len;
  }

  function enterSequence(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { next: afterLen } = readLength(buf, afterTag);
    return afterLen;
  }

  offset = enterSequence(derBytes, offset);
  offset = enterSequence(derBytes, offset);
  if (derBytes[offset] === 0xa0) offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  const { next: afterTag } = readTag(derBytes, offset);
  const { len, next: afterLen } = readLength(derBytes, afterTag);
  const end = afterLen + len;
  return derBytes.slice(offset, end).buffer;
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

async function fsRunQuery(projectId, accessToken, structuredQuery, parent = null) {
  const url = firestoreBase(projectId).replace('/documents', '') + ':runQuery';
  const body = parent ? { structuredQuery, parent } : { structuredQuery };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Firestore query failed: ' + res.status);
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => fromFirestoreFields(r.document.fields || {}));
}

async function fsPost(projectId, accessToken, path, data) {
  const url = `${firestoreBase(projectId)}/${path}`;
  const body = { fields: toFirestoreFields(data) };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore POST ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function verifyActionExists(projectId, accessToken, actorUid, targetUid, type, data) {
  if (type === 'like') {
    if (!data.postId) return false;
    const mood = await fsGet(projectId, accessToken, `posts/${data.postId}/moods/${actorUid}`);
    return !!(mood && typeof mood.mood === 'string');
  }

  if (type === 'comment') {
    if (!data.postId) return false;
    const rows = await fsRunQuery(projectId, accessToken, {
      from: [{ collectionId: 'comments' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'uid' },
          op: 'EQUAL',
          value: { stringValue: actorUid }
        }
      },
      limit: 10
    }, `projects/${projectId}/databases/(default)/documents/posts/${data.postId}`);
    return rows.some(row => {
      const created = Number(row.createdAtMs) || 0;
      return created >= Date.now() - 10 * 60_000;
    });
  }

  if (type === 'connect') {
    return !!(await fsGet(projectId, accessToken, `users/${actorUid}/following/${targetUid}`));
  }

  if (type === 'message') {
    const chatId = [actorUid, targetUid].sort().join('_');
    const rows = await fsRunQuery(projectId, accessToken, {
      from: [{ collectionId: 'messages' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'uid' },
          op: 'EQUAL',
          value: { stringValue: actorUid }
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAtMs' }, direction: 'DESCENDING' }],
      limit: 10
    }, `projects/${projectId}/databases/(default)/documents/privateChats/${chatId}`);
    const wanted = String(data.text || '');
    return rows.some(row => {
      const age = Date.now() - (Number(row.createdAtMs) || 0);
      return age >= 0 && age <= 10 * 60_000 && (!wanted || String(row.text || '') === wanted);
    });
  }

  if (type === 'share') {
    if (!data.postId) return false;
    const chatId = [actorUid, targetUid].sort().join('_');
    const rows = await fsRunQuery(projectId, accessToken, {
      from: [{ collectionId: 'messages' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'uid' },
          op: 'EQUAL',
          value: { stringValue: actorUid }
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAtMs' }, direction: 'DESCENDING' }],
      limit: 10
    }, `projects/${projectId}/databases/(default)/documents/privateChats/${chatId}`);
    return rows.some(row => {
      const age = Date.now() - (Number(row.createdAtMs) || 0);
      return age >= 0 && age <= 10 * 60_000 && String(row.sharedPostId || '') === String(data.postId);
    });
  }

  if (['badge_earned','task_reminder','challenge_reminder','streak_warning','task_complete'].includes(type)) {
    return targetUid === actorUid;
  }

  return false;
}
const notificationRateLimit = new Map();
function allowedNotification(uid) {
  const now = Date.now();
  const recent = (notificationRateLimit.get(uid) || []).filter(t => now - t < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  notificationRateLimit.set(uid, recent);
  return true;
}

function pushCopy({ type, actorName, text, title }) {
  const who = actorName || "Someone";
  const map = {
    like: { title: "New like", body: `${who} liked your post` },
    comment: { title: "New comment", body: `${who} commented on your post` },
    share: { title: "Post shared", body: `${who} shared your post` },
    connect: { title: "New connection", body: `${who} connected with you` },
    message: { title: "New message", body: `${who}: ${text || "New message"}` },
    badge_earned: {
      title: title || "Badge unlocked!",
      body: text || "You earned a new badge",
    },
    task_reminder: {
      title: title || "Task reminder",
      body: text || "You have tasks waiting",
    },
    challenge_reminder: {
      title: title || "Challenge reminder",
      body: text || "A challenge needs you",
    },
    streak_warning: {
      title: title || "Streak at risk!",
      body: text || "Complete a task today",
    },
    task_complete: {
      title: title || "Task complete",
      body: text || "Nice work!",
    },
  };
  return (
    map[type] || {
      title: title || "Trio Day",
      body: text || `${who} sent you an update`,
    }
  );
}

function pushUrl({ type, actorUid, postId, urlPath }) {
  if (urlPath) return `${APP_BASE}/${String(urlPath).replace(/^\//, "")}`;
  if (type === "message")
    return `${APP_BASE}/chat.html?uid=${encodeURIComponent(actorUid || "")}`;
  if (type === "connect") {
    return actorUid
      ? `${APP_BASE}/profile.html?uid=${encodeURIComponent(actorUid)}`
      : `${APP_BASE}/all-users.html`;
  }
  if (
    [
      "task_reminder",
      "challenge_reminder",
      "streak_warning",
      "task_complete",
    ].includes(type)
  ) {
    return `${APP_BASE}/tasks.html`;
  }
  if (type === "badge_earned") return `${APP_BASE}/profile.html`;
  if (postId)
    return `${APP_BASE}/view_post.html?postId=${encodeURIComponent(postId)}`;
  return `${APP_BASE}/index.html`;
}

async function handleCreateNotification(request, env) {
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "POST only" }, 405, origin);
  }

  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  if (
    !env.FIREBASE_PROJECT_ID ||
    !env.FIREBASE_SA_CLIENT_EMAIL ||
    !env.FIREBASE_SA_PRIVATE_KEY
  ) {
    return json({ error: "Server configuration incomplete" }, 500, origin);
  }

  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!idToken) {
    return json({ error: "Authorization header required" }, 401, origin);
  }

  let tokenPayload;
  try {
    tokenPayload = await verifyFirebaseIdToken(
      idToken,
      env.FIREBASE_PROJECT_ID,
      caches.default,
    );
  } catch (err) {
    return json({ error: "Unauthorized", detail: err.message }, 401, origin);
  }

  const actorUid = tokenPayload.sub;
  if (!actorUid) return json({ error: "Invalid token: no uid" }, 401, origin);
  if (!allowedNotification(actorUid)) {
    return json({ error: "Notification rate limit exceeded" }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { targetUid, type, ...notificationData } = body;

  if (!targetUid || !type) {
    return json({ error: "targetUid and type required" }, 400, origin);
  }

  if (!ALLOWED_NOTIFICATION_TYPES.includes(type)) {
    return json({ error: "Invalid notification type" }, 400, origin);
  }

  if (
    targetUid === actorUid &&
    ![
      "badge_earned",
      "task_reminder",
      "challenge_reminder",
      "streak_warning",
      "task_complete",
    ].includes(type)
  ) {
    return json(
      { error: "Cannot send social notification to self" },
      400,
      origin,
    );
  }

  const projectId = env.FIREBASE_PROJECT_ID || PROJECT_ID;
  const accessToken = await getAccessToken(env);
  const hasAction = await verifyActionExists(
    projectId,
    accessToken,
    actorUid,
    targetUid,
    type,
    notificationData,
  );
  if (!hasAction) {
    return json({ error: "Action verification failed" }, 400, origin);
  }

  const targetUser = await fsGet(
    env.FIREBASE_PROJECT_ID,
    accessToken,
    `users/${targetUid}`,
  );
  if (!targetUser) {
    return json({ error: "Target user not found" }, 404, origin);
  }

  const settings = targetUser.notificationSettings || {};
  const typeEnabled = settings[type] !== false;
  const pushEnabled = settings.pushEnabled !== false;

  if (!typeEnabled || !pushEnabled) {
    return json(
      { ok: true, suppressed: true, reason: "user settings" },
      200,
      origin,
    );
  }

  const actorUser = await fsGet(
    env.FIREBASE_PROJECT_ID,
    accessToken,
    `users/${actorUid}`,
  );
  const actorName = actorUser?.name || "Someone";

  const copy = pushCopy({
    type,
    actorName,
    text: notificationData.text,
    title: notificationData.title,
  });
  const url = pushUrl({
    type,
    actorUid,
    postId: notificationData.postId,
    urlPath: notificationData.urlPath,
  });

  const notificationDoc = {
    ...notificationData,
    type,
    actorUid,
    actorName,
    title: copy.title,
    text: copy.body,
    read: false,
    createdAtMs: Date.now(),
  };

  await fsPost(
    env.FIREBASE_PROJECT_ID,
    accessToken,
    `users/${targetUid}/notifications`,
    notificationDoc,
  );

  if (targetUser.oneSignalId) {
    await sendOneSignalPush(
      env,
      targetUser.oneSignalId,
      copy.title,
      copy.body,
      url,
    );
  }

  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    if (path === "/notifications/create") {
      return handleCreateNotification(request, env);
    }

    return json(
      { error: "Not found" },
      404,
      request.headers.get("Origin") || "",
    );
  },
};
