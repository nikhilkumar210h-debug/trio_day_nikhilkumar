/**
 * Cloudflare Worker — authenticated Cloudinary signing endpoint.
 *
 * The browser never receives the Cloudinary API secret or an unsigned
 * upload preset. The Worker verifies the Firebase ID token, rate-limits
 * signature issuance, derives the asset path from the authenticated UID,
 * and signs only a narrow, server-controlled set of upload parameters.
 *
 * Endpoint:
 *   POST /media/sign
 *
 * Required Worker secret:
 *   CLOUDINARY_API_SECRET
 *
 * Public Worker vars:
 *   FIREBASE_PROJECT_ID
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 */

import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

const FIREBASE_PUBLIC_KEYS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 12;
const MAX_BODY_BYTES = 4096;

const ALLOWED_KINDS = {
  post: {
    resourceType: "image",
    folder: "trio/posts",
    formats: "jpg,jpeg,png,webp",
  },
  story_image: {
    resourceType: "image",
    folder: "trio/stories",
    formats: "jpg,jpeg,png,webp",
  },
  story_video: {
    resourceType: "video",
    folder: "trio/stories",
    formats: "mp4,mov,webm,m4v",
  },
  profile: {
    resourceType: "image",
    folder: "trio/profiles",
    formats: "jpg,jpeg,png,webp",
  },
};

const rateMap = new Map();

function rateAllowed(uid) {
  const now = Date.now();
  const recent = (rateMap.get(uid) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000)),
    };
  }
  recent.push(now);
  rateMap.set(uid, recent);
  return { ok: true };
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const bytes = new Uint8Array(atob(b64 + "=".repeat(pad)).length);
  const raw = atob(b64 + "=".repeat(pad));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function b64urlJson(str) {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(str)));
}

function pemToDer(pem) {
  const body = pem
    .replace("-----BEGIN CERTIFICATE-----", "")
    .replace("-----END CERTIFICATE-----", "")
    .replace(/\s/g, "");
  return b64urlDecode(body);
}

function readDerLength(buf, offset) {
  if (buf[offset] < 0x80) return { len: buf[offset], next: offset + 1 };
  const count = buf[offset] & 0x7f;
  let len = 0;
  for (let i = 0; i < count; i++) len = (len << 8) | buf[offset + 1 + i];
  return { len, next: offset + 1 + count };
}

function skipDer(buf, offset) {
  const tagNext = offset + 1;
  const { len, next } = readDerLength(buf, tagNext);
  return next + len;
}

function enterDerSequence(buf, offset) {
  const { next } = readDerLength(buf, offset + 1);
  return next;
}

function extractPublicKeyFromCert(derBytes) {
  let offset = 0;
  offset = enterDerSequence(derBytes, offset);
  offset = enterDerSequence(derBytes, offset);
  if (derBytes[offset] === 0xa0) offset = skipDer(derBytes, offset);
  offset = skipDer(derBytes, offset);
  offset = skipDer(derBytes, offset);
  offset = skipDer(derBytes, offset);
  offset = skipDer(derBytes, offset);
  offset = skipDer(derBytes, offset);

  const { len, next } = readDerLength(derBytes, offset + 1);
  return derBytes.slice(offset, next + len).buffer;
}

async function getFirebaseKeys() {
  const response = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  if (!response.ok) throw new Error("Firebase key fetch failed");
  const certs = await response.json();

  const keys = {};
  for (const [kid, pem] of Object.entries(certs)) {
    try {
      keys[kid] = await crypto.subtle.importKey(
        "spki",
        extractPublicKeyFromCert(pemToDer(pem)),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    } catch (_) {
      // Skip malformed certificates.
    }
  }
  return keys;
}

let cachedKeys = null;
let cachedKeysAt = 0;

async function verifyFirebaseIdToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  let header;
  let payload;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch (_) {
    throw new Error("Invalid token payload");
  }

  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256") throw new Error("Unsupported token algorithm");
  if (!payload.sub) throw new Error("Missing token subject");
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token issuer mismatch");
  }
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) {
    throw new Error("Token expired");
  }
  if (Number(payload.iat || 0) > now + 60) throw new Error("Token issued in future");
  if (payload.auth_time && Number(payload.auth_time) > now + 60) {
    throw new Error("Token auth_time invalid");
  }

  if (!cachedKeys || Date.now() - cachedKeysAt > 60 * 60 * 1000) {
    cachedKeys = await getFirebaseKeys();
    cachedKeysAt = Date.now();
  }

  const publicKey = cachedKeys[header.kid];
  if (!publicKey) {
    cachedKeys = await getFirebaseKeys();
    cachedKeysAt = Date.now();
  }

  const key = cachedKeys?.[header.kid];
  if (!key) throw new Error("Unknown Firebase signing key");

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );

  if (!valid) throw new Error("Token signature invalid");
  return payload;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(digest);
}

function sanitizeUid(uid) {
  return String(uid).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeSignature(params, secret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return sha256Hex(serialized + secret);
}

async function handleSign(request, env) {
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") return json({ error: "POST only" }, 405, origin);
  if (origin && !isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
    return json({ error: "Media signing service is not configured" }, 503, origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request body too large" }, 413, origin);
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return json({ error: "Authorization required" }, 401, origin);

  let claims;
  try {
    claims = await verifyFirebaseIdToken(
      token,
      env.FIREBASE_PROJECT_ID || "nkm-ind",
    );
  } catch (error) {
    return json({ error: "Unauthorized" }, 401, origin);
  }

  const uid = sanitizeUid(claims.sub);
  if (!uid) return json({ error: "Invalid user" }, 401, origin);

  const rl = rateAllowed(uid);
  if (!rl.ok) {
    return json({ error: "Too many upload requests", retryAfter: rl.retryAfter }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const kind = String(body?.kind || "");
  const config = ALLOWED_KINDS[kind];
  if (!config) return json({ error: "Unsupported media kind" }, 400, origin);

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = kind === "profile"
    ? `${uid}_avatar`
    : `${uid}_${timestamp}_${randomId()}`;
  const overwrite = kind === "profile" ? "true" : "false";
  const params = {
    allowed_formats: config.formats,
    folder: config.folder,
    overwrite,
    public_id: publicId,
    timestamp: String(timestamp),
  };

  const signature = await makeSignature(params, env.CLOUDINARY_API_SECRET);

  return json({
    ok: true,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    resourceType: config.resourceType,
    allowedFormats: config.formats,
    folder: config.folder,
    publicId,
    overwrite: kind === "profile",
    timestamp,
    signature,
  }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    if (path === "/media/sign") return handleSign(request, env);
    return json({ error: "Not found" }, 404, request.headers.get("Origin") || "");
  },
};
