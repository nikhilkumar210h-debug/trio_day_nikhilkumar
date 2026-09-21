/**
 * Cloudflare Worker — Trio Day Cloudinary Signed Upload
 *
 * POST /media/sign
 *   Auth: Authorization: Bearer <firebase-id-token>
 *   Body: { "kind": "story_image" | "story_video" | "profile" }
 *   Returns: Cloudinary signed upload params (signature, timestamp, cloudName, apiKey, resourceType, folder, publicId, allowedFormats, overwrite)
 *
 * Security:
 * - Verifies Firebase ID token
 * - Generates Cloudinary signature server-side using API secret
 * - Worker controls folder/public_id/resource_type — client cannot override
 * - Per-UID rate limiting on signature generation
 * - CORS restricted to Trio Day origins
 */

import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIREBASE_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Per-UID rate limiting (20 requests/minute for signature generation)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitMap = new Map(); // uid -> [timestamps]

function checkRateLimit(uid) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(uid) || [];
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  rateLimitMap.set(uid, recent);
  return { allowed: true };
}

// Upload kind configuration — Worker controls all Cloudinary parameters
const UPLOAD_KINDS = {
  story_image: {
    resourceType: 'image',
    folder: 'trio/stories',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    overwrite: false,
    maxFileSize: 12 * 1024 * 1024,
  },
  story_video: {
    resourceType: 'video',
    folder: 'trio/stories',
    allowedFormats: ['mp4', 'mov', 'webm'],
    overwrite: false,
    maxFileSize: 100 * 1024 * 1024,
  },
  profile: {
    resourceType: 'image',
    folder: 'trio/profiles',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    overwrite: true,
    maxFileSize: 8 * 1024 * 1024,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function generatePublicId(kind, uid) {
  const cfg = UPLOAD_KINDS[kind];
  if (kind === 'profile') {
    return `${uid}_avatar`;
  }
  return `${uid}_${Date.now()}_${randomId()}`;
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// HMAC-SHA1 for Cloudinary signature
async function cloudinarySha1Signature(secret, data) {
  // Cloudinary authentication signatures are SHA-1(data + api_secret),
  // not HMAC-SHA1.
  const bytes = new TextEncoder().encode(data + secret);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyFirebaseIdToken(idToken, projectId) {
  const response = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  if (!response.ok) throw new Error('Failed to fetch Firebase public keys');
  const jwks = await response.json();

  const [headerB64, payloadB64, signatureB64] = idToken.split('.');
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid token format');
  }

  const decodeJwtPart = (value) => {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  };

  const header = decodeJwtPart(headerB64);
  const payload = decodeJwtPart(payloadB64);

  const key = Array.isArray(jwks.keys) ? jwks.keys.find(k => k.kid === header.kid) : null;
  if (!key) throw new Error('Key not found');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  if (!verified) throw new Error('Invalid signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.auth_time > now) throw new Error('Token not yet valid');
  if (payload.aud !== projectId) throw new Error('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid issuer');

  return payload;
}

// ─── Request Handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    if (url.pathname !== '/media/sign') {
      return json({ error: 'Not found' }, 404, origin);
    }

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'Origin not allowed' }, 403, origin);
    }

    // Verify required secrets
    if (!env.FIREBASE_PROJECT_ID || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return json({ error: 'Server configuration incomplete' }, 500, origin);
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      return json({ error: 'Authorization header required' }, 401, origin);
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return json({ error: 'Unauthorized', detail: err.message }, 401, origin);
    }

    const uid = tokenPayload.sub;
    if (!uid) return json({ error: 'Invalid token: no uid' }, 401, origin);

    // Rate limit
    const rateLimit = checkRateLimit(uid);
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, 429, origin);
    }

    // Reject oversized bodies
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 2048) {
      return json({ error: 'Request body too large' }, 413, origin);
    }

    // Parse body
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    const kind = body?.kind;
    if (!kind || !UPLOAD_KINDS[kind]) {
      return json({ error: 'Invalid or missing kind. Allowed: story_image, story_video, profile' }, 400, origin);
    }

    const cfg = UPLOAD_KINDS[kind];
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = generatePublicId(kind, uid);

    // Build signature payload — Cloudinary expects params sorted alphabetically
    // Format: "folder=...&overwrite=...&public_id=...&resource_type=...&timestamp=..."
    const paramsToSign = {
      folder: cfg.folder,
      overwrite: String(cfg.overwrite),
      public_id: publicId,
      timestamp: String(timestamp),
    };

    const sortedKeys = Object.keys(paramsToSign).sort();
    const signatureString = sortedKeys.map(k => `${k}=${paramsToSign[k]}`).join('&');
    const signature = await cloudinarySha1Signature(env.CLOUDINARY_API_SECRET, signatureString);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${cfg.resourceType}/upload`;

    return json({
      signature,
      timestamp,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      resourceType: cfg.resourceType,
      folder: cfg.folder,
      publicId,
      allowedFormats: cfg.allowedFormats,
      overwrite: cfg.overwrite,
      uploadUrl,
      maxFileSize: cfg.maxFileSize,
    }, 200, origin);
  }
};