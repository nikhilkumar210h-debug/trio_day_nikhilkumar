/**
 * OPTIONAL: Cloudflare Worker cron for offline reminders & cleanup.
 * App-open reminders already work without this (see gamification/reminders.js).
 *
 * Setup (later):
 * 1. Add Firestore REST access (service account) or Admin API proxy
 * 2. Reuse ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY secrets
 * 3. wrangler.toml:
 *      [triggers]
 *      crons = ["0 */6 * * *"]
 * 4. Deploy: npx wrangler deploy
 *
 * Intended jobs:
 * - Expire communityTasks where endAtMs < now
 * - Delete users/{uid}/progress/{periodKey} older than retention
 * - Streak-about-to-break OneSignal pushes
 * - Challenge ending-soon pushes
 *
 * This stub does not call Firestore yet (keeps Spark / no Blaze).
 */

export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Cron stub — wire Firestore REST + OneSignal when ready'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },

  async scheduled(event, env, ctx) {
    // Placeholder: no-op until Firestore credentials are configured.
    console.log('gamification-cron tick', event.cron, Date.now());
  }
};
