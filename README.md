# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social web app built around **Activities**, private conversations, people discovery, and Activity-based progress.

## Current product direction

The current strategic direction is **Activity-first daily habits**.

> **One small meaningful activity I complete every day.**

Activities replace Challenges as the primary interaction engine. Each Activity has 3–5 step-by-step tasks with timers, proof input, and AI verification. Weekly XP resets every Sunday; Top 3 get podium spots.

The current product/UX roadmap and decision sequence are maintained in **[PLAN.md](PLAN.md)**.

### Product priorities

**Keep and strengthen**
- Daily Activities with step-by-step task player.
- Activities: choose category → browse activities → complete tasks → earn XP.
- Solo progress, XP and streak (server-authoritative).
- Simplified You/Profile.
- Supporting private Chat when a real relationship or action exists.
- User-initiated share cards suitable for WhatsApp.
- Guest Trial: 3 free tasks, no login required.

**Defer / simplify**
- Stories as a primary product surface.
- Large leaderboard emphasis while the user base is small.
- Generic social-feed behavior.
- Mandatory photo proof (text reflection is enough).

The app should not depend on having an existing social graph just to provide first-session value.

## Deployment

### Current production

- **Frontend / canonical production:** Cloudflare Workers  
  https://trio-day.trioday-nikhil.workers.dev/
- **Backend/API:** Cloudflare Workers (gamification + activities, media sign, notifications). The legacy Render-hosted Flask backend has been retired and removed.
- **Authentication + database:** Firebase Authentication + Cloud Firestore.
- **Activity/Task definitions:** Supabase (PostgreSQL).
- **Media:** Cloudinary where configured (auto-optimized: `f_auto,q_auto,c_fill,g_auto,w_800`).
- **Notifications:** Existing OneSignal/notification Worker where configured.

### Legacy hosting

`https://nkm-ind.web.app/` is a **legacy Firebase Hosting URL** and must not be treated as the designated production host.

Do not migrate hosting or remove old hosting configuration simply because Firebase Hosting files remain in the repository.

## Change-control rule

No existing feature, file, backend component, Worker, deployment configuration, Firestore collection/data, Firebase rule, or production configuration may be deleted, disabled, renamed, or replaced without explicit approval for that specific change.

Do not treat an apparently unused file as permission to delete it.

Before significant code work, read [PLAN.md](PLAN.md), identify the stage being implemented, and report the exact scope of changes.

## Current product

### Today (Activities Dashboard)
- **Guest View**: 3 free starter activities (Supabase `is_guest_allowed=true`). Progress saved in `localStorage`. After 3 tasks → Login modal to sync XP.
- **Logged-in Onboarding**: First visit shows 5 Goal Cards (Learning, Digital Skill, Personal Growth, Mind & Emotion, Social Life). Selection saved to Firestore.
- **Dashboard**: Category-specific activities with clickable cards (Cyber-Purple + Neon Cyan glassmorphism). Each card shows difficulty, XP reward, cover image.
- **Task Player**: Step-by-step with progress bar, min-time timer, proof/reflection textarea, AI verification via Cloudflare Worker.
- **Language Toggle**: EN/HI persisted in `localStorage`, updates all UI text.

### Activity Player (`/activity-player.html?act=<id>`)
- Fetches activity + tasks from Supabase.
- Progress bar at top.
- Each task: type badge, XP reward, title, description, timer (if `min_time_seconds > 0`), proof input.
- **Complete**: Sends proof to the gamification Worker → server-side response check → awards XP only after a valid result; updates weekly XP + leaderboards.
- **Skip**: 0 XP, moves to next task, logged server-side.
- **Completion Screen**: Total XP earned, final weekly XP, links to Dashboard & Leaderboard.

### Discover / People
- Real user directory with avatars, names, XP, categories.
- Top streak leaderboard.
- "Challenge them" links (legacy term, opens activity with shared context).

### Chat
- Private one-to-one conversations.
- Unread indicators and people search.
- Users can delete their own messages.

### You / Profile
- Profile photo, name, bio, Trio UID, followers/following.
- Activity XP, level, streaks, badges, progress.
- Streak Shield (earned at 7-day milestones, max 3).
- Theme controls from profile menu.

### Leaderboard (`/leaderboard.html`)
- **Top 3 Podium**: Gold (center, elevated), Silver (left), Bronze (right) floating cards with animations.
- **Full Ranking**: All users sorted by Weekly XP, current user highlighted.
- Tabs: Global XP, Weekly, Monthly, Streak (legacy, kept for compatibility).

### Admin (`/admin-activity.html`)
- **Strict admin check**: Firebase token email must match `ADMIN_EMAILS`.
- **Activities CRUD**: Create/edit/delete with Cloudinary signed upload (folder `trio/activities`, transform `f_auto,q_auto,c_fill,g_auto,w_800`).
- **Tasks CRUD**: Create/edit/delete per activity. Fields: type, title, description, instructions (EN/HI), min time, XP reward, AI verification prompt, active toggle.
- **Cloudinary signed upload**: Worker generates signature, client uploads directly to Cloudinary.

### Notifications
- Story activity.
- Connections.
- Messages.
- Activity reminders and badges.

## Authentication

- Email/password.
- Google.
- Trio UID login through the Firebase Callable `signInWithTrioUid`.
- Protected pages use the authentication guard.

## Architecture

- Static HTML/CSS/ES modules under `public/`.
- Firebase Auth + Firestore.
- Firebase Cloud Functions for the Trio UID authentication callable.
- Cloudflare Workers for server-authoritative gamification and notification operations.
- Supabase (PostgreSQL) for Activity/Task definitions.
- Cloudinary for media.
- No service worker for app content — `public/pwa-retire.js` unregisters every non-OneSignal service worker and clears Cache Storage on page load; only the OneSignal push workers (`public/push/onesignal/`) run (third-party SDK, no app cache versioning).

## Architecture inventory

### File / folder tree (condensed)

```
trio_day_main/
├─ wrangler.jsonc               # Root Worker "trio-day" — static assets only: { assets: { directory: "./public" } } (no main script)
├─ server.js                    # Local static dev server (127.0.0.1:5500, GET/HEAD only, no-store)
├─ firebase.json / .firebaserc # Legacy Firebase Hosting config + Firestore rules/indexes; project: nkm-ind
├─ firestore.rules              # Firestore security rules v2 (single source of truth for DB access)
├─ firestore.indexes.json       # Composite indexes
├─ storage-rules.txt            # Firebase Storage rules (Cloudinary fallback path uploads/{uid}/)
├─ functions/index.js           # Firebase Functions v2 callable signInWithTrioUid (us-central1) + authRateLimits
├─ workers/                     # Separate Cloudflare Workers (own wrangler.*.toml each)
│  ├─ gamification.js           #   trio-gamification — POST /gamification/* (legacy) + /api/activity/* + /api/admin/*
│  ├─ gamification-cron.js      #   trio-gamification-cron — crons for cleanup + daily question
│  ├─ media-upload.js           #   trio-media-upload — POST /media/sign (Cloudinary signatures)
│  ├─ send-notification.js      #   trio-notifications — POST /notifications/create
│  └─ shared/cors.js            #   Shared CORS allowlist (4 prod origins + localhost)
├─ public/                      # Everything below is served by the trio-day Worker as static assets
│  ├─ index.html + today-activity.js          # Today (Activities Dashboard)
│  ├─ activity-player.html + activity-player.js  # Task Player
│  ├─ login.html + auth.js      # Sign-in / sign-up
│  ├─ all-users.html + all-users.js  # Discover (user directory + streak leaderboard)
│  ├─ chat.html + chat.js       # Chat inbox (conversation list)
│  ├─ private-chat.html/.js     # 1:1 private conversation
│  ├─ profile.html/.js         # You/Profile (identity, gamification, connections)
│  ├─ leaderboard.html/.js     # Leaderboard (Podium + Full Ranking)
│  ├─ admin-activity.html/.js  # Admin Activity/Task management
│  ├─ settings / notifications / help / privacy / terms / 404 pages
│  ├─ firebase-config.js → firebase-init.js (full) / firebase-auth.js (light)  # SDK 10.13.0 bootstrap
│  ├─ auth-guard.js / auth-preload.js / auth-ui.js  # Client-side auth gate + chrome
│  ├─ image-upload.js          # Cloudinary client (signed uploads via trio-media-upload)
│  ├─ core-loop.js / experience-v2.js / webmcp.js   # Injected at runtime by ui/header.js
│  ├─ trio-cache.js / utils.js / sound-manager.js / theme.js / pwa-retire.js
│  ├─ services/                # userCache, notificationHelpers/Settings/Worker
│  ├─ gamification/            # badges, community-tasks, constants, leaderboards, streaks, worker-config, xp-levels
│  ├─ ui/                      # header, nav, sheet, toast, search, skeleton, achievements
│  └─ styles/ assets/ icons/ push/onesignal/
└─ scripts/                    # validate-repo.mjs, migrate-base64-to-storage.mjs (offline tooling)
```

### Routes — how Cloudflare Workers serves each page

The root `wrangler.jsonc` declares **no Worker script** — the production site is a pure **Workers static assets** deployment of `public/`. Workers Assets' default `html_handling` (`auto-trailing-slash`, `auto-pretty-urls`) maps pretty URLs to `.html` files. **There is no server-side routing code**; all navigation/redirect logic is client-side (`auth-guard.js` login redirects, `ui/nav.js` active state, `location.href` links).

| Route | Served file | Entry scripts | Guard |
|---|---|---|---|
| `/` | `public/index.html` | today-activity.js, auth-ui, header/nav | auth-guard |
| `/login` | `public/login.html` | auth.js | public page |
| `/all-users` | `public/all-users.html` | all-users.js | auth-guard |
| `/activity-player` | `public/activity-player.html` | activity-player.js | auth-guard |
| `/chat` | `public/chat.html` | chat.js (inbox) | auth-guard |
| `/profile` | `public/profile.html` | profile.js | auth-guard |
| `/private-chat`, `/search`, `/settings`, `/notifications`, `/leaderboard`, `/help`, `/privacy`, `/terms` | corresponding `.html` | corresponding page JS | mixed |
| `/admin-activity` | `public/admin-activity.html` | admin-activity.js | admin-only |
| unknown | `public/404.html` | — | — |

**Sidecar API Workers** (separate deployments, called from the browser):
- `trio-gamification` → `POST /gamification/award-xp`, `POST /gamification/bump-streak`, `POST /gamification/use-shield` (legacy Challenges) + **`POST /api/activity/complete-task`, `POST /api/activity/skip-task`, `POST /api/admin/activity`, `POST /api/admin/task`, `POST /api/admin/cloudinary-sign`** (NEW Activities)
- `trio-gamification-cron` → cron `0 * * * *` (expired story/voice + tempChat cleanup, Cloudinary destroy) and `15 0 * * *` (publishes `config/dailyQuestion`)
- `trio-media-upload` → `POST /media/sign` (Cloudinary signature endpoint)
- `trio-notifications` → `POST /notifications/create` (server-side notification writes)

### Firebase (Authentication + Firestore)

- **SDK**: Firebase modular SDK **10.13.0** via gstatic CDN ESM imports (`firebase-app`, `firebase-auth`, `firebase-firestore`, `firebase-storage`, `firebase-functions`) — pinned in `firebase-init.js:2-4`, `image-upload.js:182`, `auth.js:6`, etc. No npm Firebase dependency.
- **Project**: `nkm-ind` (`firebase-config.js:7`); Auth domain `nkm-ind.firebaseapp.com`.
- **Database type**: **Cloud Firestore** (`getFirestore(app)` in `firebase-init.js:8`). **No Realtime Database** is used anywhere.
- **Auth**: Email/password, Google (`auth.js:173-192`), Trio UID via callable `signInWithTrioUid` (`functions/index.js:64-121`, rate-limited via `authRateLimits` collection). `usersPrivate/{uid}` stores emails owner-only (`auth.js:113-116`).

**Firestore schema (collections actually read/written by the app):**

| Feature | Path | Key fields |
|---|---|---|
| Profile / directory | `users/{uid}` | name, userId `TRIO-XXXXXXXX`, photoURL, bio, emailHidden, updatedAt + server-protected xp, level, streakCurrent/Best/LastDate, weeklyXp, monthlyXp, badges, shields, selectedCategory, onboardingComplete |
| Connections | `users/{uid}/followers/{followerUid}`, `users/{uid}/following/{followedUid}` | uid, userId, name, createdAt |
| Notifications | `users/{uid}/notifications/{id}` | type, actorUid, actorName, text, read, createdAtMs |
| Gamification internals | `users/{uid}/progress/{periodKey}`, `users/{uid}/activityCompletions/{id}`, `users/{uid}/xpAwards/{grantKey}` (worker-written) | idempotency keys, amounts |
| Private email | `usersPrivate/{uid}` | email, updatedAt (owner-only) |
| Stories / voice | `posts/{postId}` (+ `comments/{cid}`, `likes/{uid}`, `moods/{uid}`) | type `story`/`voice`, isStory/isVoice, message, mediaUrl, privacy `public`/`friends`, allowedUids, expiresAtMs (24h window enforced by rules) |
| Daily Question | `config/dailyQuestion` (published by cron) + `dailyAnswers/{uid_questionKey}` | date, index, question, answer ≤280 |
| Leaderboards / badges | `leaderboards/{boardId}`, `badges/{badgeId}` | server-written only |
| Admin config | `config/admins`, `config/dailyQuestion` | uids list; daily prompt |
| Login rate limit | `authRateLimits/{sha256(trioUid)}` | attempts, windowStartedAtMs (Functions) |

**Rules & indexes**: `firestore.rules` (497 lines) — users readable by any signed-in user; gamification fields client-write-blocked (`noGamificationWrite`, `firestore.rules:149-161`); `userId` set-once (`canChangeUserId`, :165-175); stories create-validated with 23-25h expiry (:60-77); privateChats participant-only (:291-311); tempChats 2-participant + expiry (:339-368); communityTasks create fully schema-validated (:439-484). Composite indexes in `firestore.indexes.json` (11 indexes).

### Cloudinary upload pipeline

- **Cloud**: `vyhglthg` (`workers/wrangler.media-upload.toml:7`, client constant `public/image-upload.js:2`). **No unsigned preset — every upload is signed.**
- **Signing**: browser → `POST https://trio-media-upload.trioday-nikhil.workers.dev/media/sign` (`public/image-upload.js:5`, `getSignedParams` :87-104) with Firebase ID token; Worker (`workers/media-upload.js`) verifies the token (:100-146), rate-limits 20 signatures/min/UID (:24-39), and **controls folder/public_id/resource_type** — client cannot override:
  - `story_image` → folder `trio/stories`, jpg/jpeg/png/webp, ≤12 MB, overwrite:false
  - `story_video` → folder `trio/stories`, mp4/mov/webm, ≤100 MB, overwrite:false
  - `profile` → folder `trio/profiles`, jpg/jpeg/png/webp, ≤8 MB, overwrite:true, publicId `{uid}_avatar`
- **Admin Activity cover images**: folder `trio/activities`, transform `f_auto,q_auto,c_fill,g_auto,w_800`, overwrite:false, publicId `activity-{id}-cover`
- **Signature scheme**: SHA-1 of alphabetically sorted params + `CLOUDINARY_API_SECRET`; upload POST goes straight to `https://api.cloudinary.com/v1_1/{cloud}/{resourceType}/upload` with api_key, timestamp, signature, folder, public_id, overwrite.
- **Fallback**: if Cloudinary/Worker is unavailable, both paths fall back to **Firebase Storage** `uploads/{uid}/{fileName}` (≤40 MB, image/*|video/*, per-user isolation).
- **CORS**: Workers accept only `trio-day.trioday-nikhil.workers.dev`, `nkm-ind.web.app`, `nkm-ind.firebaseapp.com`, `trio-day.web.app`, localhost (`workers/shared/cors.js:2-7`).
- **Deletion**: expired story/voice media is destroyed from Cloudinary by the cron Worker.

### Supabase (Activities & Tasks)

- **Project**: `vccypxwiqcuexxrhtgyq` (PostgreSQL)
- **Tables**: `activities`, `tasks`
- **Access**: Anon key for reads, service role for admin writes (via Worker)
- **Row Level Security**: Enabled on both tables
- **Canonical fields used by the current frontend and gamification Worker**:
  - `activities`: `id`, `display_order`, `category`, `title_en`, `title_hi`, `description_en`, `description_hi`, `icon`, `difficulty`, `total_xp`, `cover_image_url`, `is_guest_allowed`, `is_published`, `created_at`, `updated_at`.
  - `tasks`: `id`, `activity_id`, `task_number`, `task_type`, `title_en`, `title_hi`, `description_en`, `description_hi`, `instructions_en`, `instructions_hi`, `min_time_seconds`, `xp_reward`, `verification_prompt`, `is_published`, `created_at`, `updated_at`.
  - `user_task_progress`: server-written task attempts/completions with `firebase_uid`, `activity_id`, `task_id`, `status`, `user_submission`, `ai_verified`, `ai_feedback`, `xp_awarded`, `week_key`, and `completed_at`.
  - Public reads expose published activity/task fields only; `verification_prompt` and task-progress records must remain server-only. Admin list/create/update/delete operations go through the authenticated gamification Worker using the Supabase service-role key stored as a Worker secret.

## Security

- Gamification fields are server-controlled (Worker-only writes).
- Activity XP awards are checked server-side and XP awards are idempotent. The current checker is heuristic-based, not a connected LLM; do not label it as model-based AI until a model binding/provider is configured.
- Firestore rules restrict private-chat access.
- Admin endpoints require strict email verification against `ADMIN_EMAILS`.
- AI verification rejects spam/gibberish/off-topic submissions.

## Retired product systems

The current master product does not use:
- Live Rooms / room collaboration.
- Forge.
- Build / Learn / Puzzle / Game activity lanes.
- Generic activity/task systems (replaced by new Activity system).
- The old Post/Feed viewer.
- The legacy task-reminder Worker.
- Generic Challenge-based gamification (replaced by Activity-based).

## Navigation

Canonical navigation:

**Today · Leaderboard · Chat · You · Admin** (admin only visible to admins)

The shared navigation marks the current route with an active state and `aria-current="page"`.

## Design system

- Inter is the primary UI/body font.
- Space Grotesk is the display/brand font.
- Cyber-Purple (`#8B5CF6`) + Neon Cyan (`#00FFCC`) glassmorphism theme.
- Headings use controlled 700-900 weight with gradient text effects.
- Light and dark themes share the same semantic tokens and spacing system.
- Animations: `fadeInUp`, `pulseGlow`, `floatCard`, `shimmer`.

## Gamification

Activity participation is server-authoritative: the client records the user's proof, then the authenticated gamification Worker verifies it via AI before awarding XP/streak progress. XP awards are idempotent per user + activity + task, and Firestore rules block direct client writes to protected gamification fields.

Weekly XP resets every Sunday (user's local timezone). Leaderboard rankings are based on verified task completions only.

Guest trial allows 3 free tasks. Progress is stored locally (`localStorage`) and synced once upon first login (checked via `user_sync_meta` table).

## Validation

Before production release, run the repository release checks and a browser pass covering:
- Authentication, including Trio UID login.
- Today (Guest View, Onboarding, Dashboard).
- Activity Player (timer, proof, AI verification, skip, completion).
- Leaderboard (Podium + Full Ranking).
- Chat and message deletion.
- You/profile and navigation active state.
- Admin panel (Activity/Task CRUD, Cloudinary upload).
- Mobile and desktop layouts.
- Service-worker/cache behavior.
- Firebase rules and indexes.
- Supabase RLS policies.

## Repository hygiene

Master is the production-safe source of truth. Changes should be made deliberately and verified before deployment. Legacy compatibility code should only be removed when it is confirmed unused by the current Activity, Chat, Auth, or notification flows.

---

## Phase Summary: Activity System Migration (2026-10-18)

### Phase 1: Inspect & Backup ✅
- Created git tag `backup-pre-activity-merge-20261018-180000` and branch `backup-pre-activity-merge`
- Mapped all prototype files to production targets

### Phase 2: Remove Old Challenge System ✅
- Deleted: `challenge.html`, `challenge.js`, `challenge-create.html`, `challenge-create.js`, `challenge.css`, `daily-question.js`
- Updated `ui/nav.js`: New nav = Today · Leaderboard · Chat · You · Admin
- Cleaned `index.html`: Removed Challenge/Trio Pulse/Brain Sprint sections

### Phase 3: Rebuild Today Page & Activity Player ✅
- **`public/styles/activity-player.css`**: Full Cyber-Purple + Neon Cyan design system from prototype
- **`public/index.html`**: New Activities Dashboard (Guest View, Onboarding, Dashboard)
- **`public/today-activity.js`**: Complete logic for all three views, language toggle, guest limit, login modal, XP sync
- **`public/activity-player.html` + `activity-player.js`**: Task player with timer, proof input, AI verification, skip/complete

### Phase 4: Cloudflare Worker APIs ✅
- Extended `workers/gamification.js` with new endpoints:
  - `POST /api/activity/complete-task` — Firebase token verify → AI verification → Supabase task progress → Firebase XP + leaderboard
  - `POST /api/activity/skip-task` — 0 XP, mark skipped, next task
  - `POST /api/admin/activity` — Strict admin email check, CRUD for activities
  - `POST /api/admin/task` — Strict admin email check, CRUD for tasks
  - `POST /api/admin/cloudinary-sign` — Signed upload for `trio/activities` folder with `f_auto,q_auto,c_fill,g_auto,w_800`
- Updated `workers/wrangler.gamification.toml` with new env vars

### Phase 5: Leaderboard & Legal Pages ✅
- **`public/leaderboard.html` + `leaderboard.js`**: Top-3 Podium (Gold/Silver/Bronze floating cards) + full ranking list from Firebase weekly XP
- **`public/help.html`**: Replaced Challenge refs with Activities, added Supabase storage, AI verification, 3-task Guest Trial
- **`public/privacy.html`**: Updated for Activities, Supabase, Cloudinary, Cloudflare Workers AI
- **`public/terms.html`**: Updated for Activities, XP, Guest Trial, AI verification

---

## ✅ **DEPLOYED (2026-10-18)**

| Component | URL | Version |
|-----------|-----|---------|
| **Static Assets (trio-day)** | https://trio-day.trioday-nikhil.workers.dev | `37720b6e` |
| **API Worker (trio-gamification)** | https://trio-gamification.trioday-nikhil.workers.dev | `d112f50d` |

**Git Commit:** `adc5e88` — Stage 1-3 Activity system migration

---

## 📋 **Stage Status**

| Stage | Status | Description |
|-------|--------|-------------|
| **Stage 1** | ✅ **DONE** | Crash bug fixes (optional chaining, missing imports, setupActivityForm) |
| **Stage 2** | ✅ **DONE** | Real Supabase schema match (columns, service role key, Worker endpoints) |
| **Stage 3** | ✅ **DONE** | Shared header/nav/theme (tokens.css, single header.js, single nav.js) |
| **Stage 4** | 🔄 **IN PROGRESS** | Challenge cleanup in admin-tasks.html, all-users.html, chat.html, profile.html, sitemap.html, temp-chat.html |
| **Stage 5** | ⏳ **PENDING** | Playwright MCP testing, final README, temp file cleanup |

---

## 🔐 **Required Worker Secrets (set before Stage 4 testing)**

```bash
npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # NEW - for admin writes & verification_prompt
npx wrangler secret put ADMIN_EMAILS
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

---

## 📋 **Supabase Tables Required (verify exist with RLS)**

```sql
-- activities table (existing)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_order INT DEFAULT 0,
  category TEXT NOT NULL CHECK (category IN ('Starter','Learning','Digital Skill','Personal Growth','Mind & Emotion','Social Life')),
  title_en TEXT NOT NULL,
  title_hi TEXT,
  description_en TEXT,
  description_hi TEXT,
  difficulty TEXT CHECK (difficulty IN ('Easy','Medium','Hard','Boss Level')),
  total_xp INT DEFAULT 0,
  cover_image_url TEXT,
  is_guest_allowed BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- tasks table (existing)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  task_number INT NOT NULL,
  task_type TEXT CHECK (task_type IN ('Brainteaser','Action Step','Boss Task')),
  title_en TEXT NOT NULL,
  title_hi TEXT,
  instructions_en TEXT,
  instructions_hi TEXT,
  verification_prompt TEXT,
  min_time_seconds INT DEFAULT 0,
  xp_reward INT DEFAULT 10,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, task_number)
);

-- user_task_progress table (existing)
CREATE TABLE user_task_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL,
  activity_id UUID REFERENCES activities(id),
  task_id UUID REFERENCES tasks(id),
  status TEXT CHECK (status IN ('completed','skipped')),
  user_submission TEXT,
  ai_verified BOOLEAN,
  ai_feedback TEXT,
  xp_awarded INT DEFAULT 0,
  week_key TEXT, -- e.g. 2026-W42
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(firebase_uid, task_id, week_key)
);

-- user_sync_meta table (existing)
CREATE TABLE user_sync_meta (
  firebase_uid TEXT PRIMARY KEY,
  selected_category TEXT,
  guest_xp_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ
);
```

---

## 🧪 **Testing Checklist (Stage 5)**

Run Playwright MCP tests on all pages:
- [ ] `/` (Today) — logged-out, logged-in, light, dark, 390px, 1280px
- [ ] `/login` — logged-out, light, dark, 390px, 1280px
- [ ] `/leaderboard` — logged-out, logged-in, light, dark, 390px, 1280px
- [ ] `/chat` — logged-in, light, dark, 390px, 1280px
- [ ] `/profile` — logged-in, light, dark, 390px, 1280px
- [ ] `/all-users` — logged-in, light, dark, 390px, 1280px
- [ ] `/help`, `/privacy`, `/terms` — logged-out/logged-in
- [ ] `/admin-activity` — admin only, light/dark
- [ ] `/activity-player.html?act=<id>` — complete, skip, guest limit, login sync

**All tests must have: 0 console errors, 0 failed network calls.**

---

## 🗑️ **Cleanup (after Stage 4)**

```bash
# Remove temp files (already in .gitignore)
rm -f temp_secret.bin temp_private_key.pem scripts/serviceAccountKey.json

# Remove overly broad test ignore if hiding real tests
# Edit .gitignore: remove *.spec.js line if needed
```