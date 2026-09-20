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
  async fetch(request) {
    return new Response(JSON.stringify({
      error: "This endpoint is retired. Use /notifications/create with a Firebase ID token."
    }), {
      status: 410,
      headers: { "Content-Type": "application/json" }
    });
  }
};
