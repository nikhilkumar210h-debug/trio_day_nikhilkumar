TRIO DAY / independence_day — Community + Gamification
======================================================

Project path: E:\study_ml\html\independence_day

WHAT'S NEW (Gamification)
-------------------------
- Tasks hub (tasks.html): daily / weekly / monthly from CENTRAL templates
- Progress only: users/{uid}/progress/{periodKey} — NOT one doc per daily task
- Community tasks + challenges: any logged-in user creates from templates; join, like, comment, complete, follow creator
- Admins moderate only: feature / hide / archive / remove (not required to create)
- XP, levels, streaks, badges on profile
- Leaderboards: global, friends, weekly, monthly, streak
- App-open reminders (task / streak / challenge) + OneSignal via existing worker
- Admin page (admin-tasks.html) gated by config/admins
- Auto-metrics: posts / likes / comments bump matching task progress

Modular folders:
  gamification/   — XP, streaks, badges, templates, progress, community, boards, reminders
  ui/             — tasks.css, achievements popup, nav helper


YOU MUST EDIT MANUALLY (Firebase Console)
-----------------------------------------
1) Create Firestore document:
     Collection: config
     Document ID: admins
     Field: uids (array of strings) = your Firebase Auth UID(s)
   Example: { "uids": ["abc123YourUid"] }

2) Firestore → Rules → paste entire firebase-rules.txt → Publish

3) If Console asks for indexes (communityTasks status+kind+createdAtMs),
   click the link in the error and create them.

4) Hard refresh the site: Ctrl + Shift + R

5) Optional later: workers/gamification-cron.js for offline cleanup/reminders
   (app-open reminders already work without this)


Existing notes
--------------
- Apply firebase-rules.txt before testing chat/connect/comments on a fresh project.
- Images use Cloudinary unsigned preset trio_uploads — Firebase Storage / Blaze not required.
- Push: notifications.js → Cloudflare Worker (workers/send-push.js) → OneSignal
- Keep images compressed (free-plan style).
