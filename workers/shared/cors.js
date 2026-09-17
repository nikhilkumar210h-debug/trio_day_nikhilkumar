// Shared CORS helpers — Phase 0 dedupe (was duplicated in gamification.js + send-push.js)
export const ALLOWED_ORIGINS = [
  "https://nkm-ind.web.app",
  "https://nkm-ind.firebaseapp.com"
];

// Local dev origins — the browser's Origin header includes the port
// (e.g. http://127.0.0.1:3000), so we match on scheme + host and allow any port.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return u.protocol === "http:" && LOCAL_HOSTS.includes(u.hostname);
  } catch (_) {
    return false;
  }
}

export function corsHeaders(origin) {
  const allow = isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin || "") }
  });
}
