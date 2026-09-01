/**
 * Cloudflare Worker - OneSignal push proxy (free tier, no Firebase Blaze).
 *
 *   cd workers
 *   npx wrangler secret put ONESIGNAL_APP_ID
 *   npx wrangler secret put ONESIGNAL_REST_API_KEY
 *   npx wrangler deploy
 */

import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

export default {
  async fetch(request, env) {
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

    const appId = env.ONESIGNAL_APP_ID;
    const restKey = env.ONESIGNAL_REST_API_KEY;
    if (!appId || !restKey) {
      return json({ error: "Server missing OneSignal secrets" }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const subscriptionId = String(body.subscriptionId || body.oneSignalId || "").trim();
    if (!subscriptionId || subscriptionId.length > 128) {
      return json({ error: "subscriptionId required" }, 400, origin);
    }

    const title = String(body.title || "Trio Day").slice(0, 100);
    const message = String(body.body || body.message || "New notification").slice(0, 240);
    const url = typeof body.url === "string" ? body.url.slice(0, 500) : undefined;

    const payload = {
      app_id: appId,
      include_subscription_ids: [subscriptionId],
      headings: { en: title },
      contents: { en: message },
      target_channel: "push"
    };
    if (url) payload.url = url;

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Key " + restKey
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return json({ error: "OneSignal rejected", details: data }, res.status, origin);
    }
    return json({ ok: true, id: data.id || null }, 200, origin);
  }
};
