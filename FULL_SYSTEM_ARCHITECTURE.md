# FULL SYSTEM ARCHITECTURE — Trio Day

> **Generated:** Tue Oct 20 2026  
> **Project:** Trio Day (trio_day_main)  
> **Root:** `C:\Users\Nikhil Kumar\Documents\trio_day_main`  
> **Status:** Production-deployed hybrid static SPA + Cloudflare Workers + Firebase + Supabase  
> **Audience:** Principal System Architect / Lead Developer taking full control of the codebase  

---

## TABLE OF CONTENTS

1. [Deep File Interconnectivity & Purpose](#1-deep-file-interconnectivity--purpose)
2. [Complete Database & Data Flow Matrix](#2-complete-database--data-flow-matrix)
3. [Workers & Background Processes](#3-workers--background-processes)
4. [Critical Developer Code Blocks](#4-critical-developer-code-blocks)
5. [Local Self-Hosting Guide (Step-by-Step for Your Laptop)](#5-local-self-hosting-guide-step-by-step-for-your-laptop)

---

## 1. DEEP FILE INTERCONNECTIVITY & PURPOSE

This section maps every single file in the repository, its exact purpose, what it imports/exports, and what happens if it breaks.

### 1.1 Repository Root — High-Level Directory Tree

```
trio_day_main/                                    # Project root (git repo)
├── .agents/                                      # Agent configuration instructions
├── .claude/                                      # Claude agent instructions
├── .github/                                      # GitHub workflows / issue templates
├── .playwright-mcp/                              # Playwright MCP configuration
├── .venv/                                        # Python virtual environment (migration scripts)
├── .vscode/                                      # VS Code workspace settings
├── .wrangler/                                    # Wrangler local dev state (Workers)
├── functions/                                    # Firebase Functions v2 (Callable auth endpoint)
│   ├── index.js                                  # signInWithTrioUid callable + authRateLimits
│   ├── package.json / package-lock.json          # firebase-admin, firebase-functions deps
│   ├── README.md / .gitignore
├── public/                                       # STATIC SPA — served by Cloudflare Workers Assets
│   ├── index.html                                # Today (Activities Dashboard) — root page
│   ├── login.html                                # Sign-in / sign-up page
│   ├── profile.html                              # You/Profile page (identity, gamification, connections)
│   ├── leaderboard.html                          # Leaderboard (Podium + Full Ranking)
│   ├── chat.html                                 # Chat inbox (conversation list)
│   ├── private-chat.html                         # 1:1 private conversation
│   ├── activity-player.html                      # Task Player (Activities system)
│   ├── admin-activity.html                       # Admin Activity/Task management
│   ├── all-users.html                            # Discover (user directory + streak leaderboard)
│   ├── search.html                               # People / activity search
│   ├── settings.html                             # User settings
│   ├── notifications.html                        # Notification center
│   ├── help.html                                 # Help Center
│   ├── privacy.html / terms.html                 # Legal pages
│   ├── 404.html / sitemap.html / robots.txt / sitemap.xml
│   ├── manifest.json / favicon.ico
│   ├── firebase-config.js                        # Single-source Firebase config object
│   ├── firebase-init.js                          # Full Firebase init (Auth + Firestore) — ESM
│   ├── firebase-auth.js                          # Light Firebase init (Auth only) — ESM
│   ├── auth.js                                   # Login/signup logic + profile save
│   ├── auth-guard.js                             # Client-side auth gate for protected pages
│   ├── auth-preload.js                           # Early auth gate (prevents flash of protected UI)
│   ├── auth-ui.js                                # Global auth chrome (header chip, notifications, chat dots)
│   ├── utils.js                                  # Shared utilities (makeUserId, escapeHtml, chatId, Cloudinary URL helper)
│   ├── script.js                                 # Today dashboard main logic (Brain Sprint, Trio Pulse, stories)
│   ├── image-upload.js                           # Cloudinary signed upload client (story + profile media)
│   ├── onesignal.js                              # OneSignal push SDK init + save subscription to Firestore
│   ├── onesignal-config.js                       # Public OneSignal config (APP_ID only)
│   ├── trio-cache.js                             # Central in-memory + localStorage cache with TTL
│   ├── sound-manager.js                          # Web Audio API sound effects
│   ├── theme.js                                  # Dark/light theme controls
│   ├── pwa-retire.js                             # Unregisters non-OneSignal service workers on load
│   ├── webmcp.js                                 # WebMCP tool registration for in-browser AI agents
│   ├── core-loop.js / experience-v2.js           # Injected at runtime by ui/header.js
│   ├── gamification/                             # Frontend gamification helpers
│   │   ├── worker-config.js                      # Gamification Worker URL + workerPost()
│   │   ├── xp-levels.js                          # awardXp() — calls Worker for XP awards
│   │   ├── constants.js                          # XP_PER_LEVEL, badges, timezone helpers
│   │   ├── community-tasks.js                    # Firestore CRUD for community challenges
│   │   ├── leaderboards.js / streaks.js / badges.js
│   ├── services/                                 # Shared service modules
│   │   ├── userCache.js                          # getCachedUser / ensureUserProfile (single source)
│   │   ├── notifications.js                      # notifyUser, pushCopy, pushUrl, notificationText, createNotificationViaWorker, settings
│   │   ├── infiniteChallenges.js                 # Brain Sprint challenge bank (no Firestore)
│   ├── ui/                                       # Global UI components
│   │   ├── nav.js                                # Bottom nav + desktop rail (Today · Leaderboard · Chat · You · Admin)
│   │   ├── header.js                             # Global header wiring (search slot, notifications, theme)
│   │   ├── sheet.js / ui-kit.js / achievements.js / search.js
│   ├── styles/                                   # CSS stylesheets
│   │   ├── style.css / activity-player.css / chat.css / profile.css / etc.
│   ├── assets/ / icons/ / push/onesignal/        # Static assets + OneSignal push worker
├── workers/                                      # Cloudflare Workers (5 separate deployments)
│   ├── site.js                                   # trio-day — static assets + SPA pretty-URL routing
│   ├── gamification.js                           # trio-gamification — gamification + activity API (1217 lines)
│   ├── gamification-cron.js                      # trio-gamification-cron — hourly cleanup + daily question
│   ├── media-upload.js                           # trio-media-upload — Cloudinary signed upload params
│   ├── send-notification.js                      # trio-notifications — server-authoritative notifications
│   ├── shared/cors.js                            # Shared CORS allowlist + helpers (deduped)
│   ├── wrangler.jsonc / wrangler.*.toml          # Per-worker deployment configs
│   ├── .dev.vars                                 # Local dev secrets (Cloudinary, Firebase project ID)
├── scripts/                                      # Offline tooling (Node + Python venv)
│   ├── migrate-base64-to-storage.mjs             # Migrate base64 images Firestore → Cloudinary
│   ├── validate-repo.mjs                         # Release checks (JS syntax, broken refs, JSON validity)
├── server.js                                     # LOCAL dev static server (127.0.0.1:5500, GET/HEAD only)
├── wrangler.jsonc                                # Root Worker "trio-day" — static assets only (no script)
├── firebase.json / .firebaserc                   # Legacy Firebase Hosting config (project nkm-ind)
├── firestore.rules / firestore.indexes.json      # Firestore security rules v2 + composite indexes
├── .env / .env.example                           # Local environment variables (gitignored .env)
├── package.json / package-lock.json              # wrangler, playwright, shadcn dev deps
├── playwright.config.js / qa-audit.spec.js       # E2E test configuration + QA audit spec
├── README.md / PLAN.md / opencode.json / skills-lock.json
└── local_changes_backup.patch                    # Backup patch of local changes
```

---

### 1.2 Every File — Purpose, Imports/Exports, Breakage Impact

#### 1.2.1 Root Configuration & Entry Files

**`package.json`**
- **Purpose:** Node project manifest. Declares name `trio_day_main`, version `1.0.0`, entry point `server.js`, scripts (`start`, `test`, `test:qa`, `test:headed`), devDependencies (`wrangler`, `@playwright/test`, `shadcn`). `"type": "commonjs"`.
- **Imports/Exports:** Not a module — declarative JSON only.
- **If it breaks:** `npm install` and `npm start` fail; `npx wrangler` unavailable locally. The app's static files still exist but cannot be served via the npm scripts.

**`server.js`**
- **Purpose:** Local-only static file server for localhost development. Serves `public/` directory on `http://127.0.0.1:5500` (configurable via `PORT`, `TRIO_HOST`, `TRIO_PUBLIC_ROOT` env vars). GET/HEAD only — no POST, no API routing, no database. Includes directory-traversal protection (`safeFilePath`), security headers (`X-Content-Type-Options: nosniff`, `Cache-Control: no-store`), MIME type mapping.
- **Imports/Exports:** Node built-ins `http`, `fs`, `path`. No imports from app code. Exports nothing (standalone script).
- **If it breaks:** Local development cannot run `npm start`. You must use another static server (e.g. `python -m http.server`, `npx serve`, or Cloudflare `wrangler dev`) to serve `public/`. Production is unaffected (uses Cloudflare Workers Assets).

**`wrangler.jsonc`**
- **Purpose:** Root Cloudflare Worker configuration for deployment `trio-day`. Declares `main: ./workers/site.js`, assets directory `./public`, `run_worker_first: ["/admin", "/admin/*"]`. This is the production frontend host.
- **Imports/Exports:** JSONC config only. Consumed by `wrangler deploy` / `wrangler dev`.
- **If it breaks:** `wrangler deploy` fails; production site cannot be updated. Local `wrangler dev` fails to start the root worker. Static files can still be served by `server.js` directly.

**`.env`** (gitignored, local only)
- **Purpose:** Local environment variables. Contains `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `FIREBASE_PROJECT_ID=nkm-ind`, `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON), `ALLOWED_ORIGINS`, `MAX_NOTIFICATION_TEXT=500`.
- **Imports/Exports:** Loaded by shell scripts / `wrangler dev` via `.dev.vars`; read by Node scripts in `scripts/`.
- **If it breaks:** Local scripts that need Firebase Admin or OneSignal fail. Frontend still works (config is baked into `firebase-config.js` and `onesignal-config.js`).

**`.env.example`**
- **Purpose:** Template showing required env var keys without secrets.
- **If it breaks:** No runtime impact; just documentation missing.

**`firebase.json` / `.firebaserc`**
- **Purpose:** Legacy Firebase Hosting configuration. Project `nkm-ind`. Hosting public dir = `public/`. Firestore rules = `firestore.rules`, indexes = `firestore.indexes.json`. Functions source = `functions/`. Defines cache headers for HTML/CSS/JS/images, OneSignal service worker, auth iframe.
- **Imports/Exports:** Consumed by Firebase CLI (`firebase deploy`).
- **If it breaks:** Firebase Hosting deployments fail. Firestore rules/indexes are separate files — those still apply if deployed via console.

**`firestore.rules`** (498 lines)
- **Purpose:** Single source of truth for Firestore security. v2 rules. Key functions: `signedIn()`, `owner(uid)`, `isAdmin()`, `gamificationKeys()` (protected: xp, level, streakCurrent/Best/LastDate, weeklyXp, monthlyXp, badges, shields), `noGamificationWrite()`, `canChangeUserId()` (userId set-once), `validStoryCreate()` (23-25h expiry window), `validVoiceCreate()`. Collection rules: `posts/{postId}` (stories/voice, read by signed-in, create validated, delete by owner), `users/{userId}` (read by all signed-in, create/update by owner with gamification block), `usersPrivate/{userId}` (owner only), `challengeAnswers` (read all signed-in, create/update own), `challengeThreads` (public read, create own), `privateChats/{chatId}` (participant-only), `tempChats` (2-participant + expiry), `dailyAnswers`, `config/{docId}` (read signed-in, write false), `badges` (admin write), `leaderboards` (server-only write), `communityTasks` (fully schema-validated create, admin update/delete).
- **Imports/Exports:** Consumed by Firebase CLI / Firebase console. Not imported by JS at runtime.
- **If it breaks:** All client Firestore reads/writes fail with permission denied. The app becomes read-only or broken for authenticated users. Gamification fields cannot be written by clients (by design).

**`firestore.indexes.json`**
- **Purpose:** 11 composite indexes for `posts` (type+createdAtMs, privacy+createdAtMs, privacy+allowedUids+createdAtMs, uid+isStory+createdAtMs, type+isStory+privacy+expiresAtMs, etc.), `communityTasks` (status+createdAtMs, status+kind+createdAtMs), `matchmakingQueue`. Field overrides: `users.userId` (collection ASC), `members.uid` (collection-group ASC).
- **Imports/Exports:** Consumed by Firebase CLI. Not imported at runtime.
- **If it breaks:** Composite queries (e.g. `listCommunityTasks`, story strip queries) fail with "index required" errors. App degrades but single-field queries still work.

**`local_changes_backup.patch`**
- **Purpose:** Git patch backup of uncommitted local changes.
- **If it breaks:** No runtime impact; recovery artifact missing.

**`opencode.json` / `skills-lock.json`**
- **Purpose:** OpenCode agent configuration and skills lock file.
- **If it breaks:** Agent behavior affected; no app runtime impact.

**`README.md` / `PLAN.md`**
- **Purpose:** Project documentation, deployment info, architecture inventory, required Worker secrets, Supabase SQL schema, testing checklist.
- **If it breaks:** Documentation missing; no runtime impact.

**`playwright.config.js` / `qa-audit.spec.js`**
- **Purpose:** E2E test configuration and QA audit spec covering all pages (logged-out, logged-in, light/dark, mobile/desktop).
- **If it breaks:** `npm test` fails; no production impact.

---

#### 1.2.2 Cloudflare Workers

**`workers/site.js`** (47 lines)
- **Purpose:** Main site Worker — `trio-day` deployment. Handles extension-less URL mapping (`/login` → `/login.html`, `/admin` → `/admin-activity.html`, `/profile` → `/profile.html`, etc.) and SPA fallback (adds `.html` to extension-less paths). Serves static assets from `env.ASSETS`.
- **Imports/Exports:** ES module default export `{ async fetch(request, env, ctx) }`. Imports nothing.
- **If it breaks:** Production site at `https://trio-day.trioday-nikhil.workers.dev` cannot resolve pretty URLs or serve assets. Local `server.js` unaffected.

**`workers/gamification.js`** (1217 lines — THE LARGEST FILE)
- **Purpose:** `trio-gamification` Worker. Server-authoritative gamification + Activities API. All endpoints require `Authorization: Bearer <Firebase ID token>`. Verifies token via Firebase public keys, derives `uid`, enforces per-UID rate limiting (10 req/min), then writes via Firebase Admin SDK (service account JWT) to Firestore and Supabase via REST.
  - **Endpoints:**
    - `POST /gamification/award-xp` — legacy XP award (Challenges system)
    - `POST /gamification/bump-streak` — legacy streak bump
    - `POST /gamification/use-shield` — legacy streak shield
    - `POST /api/activity/complete-task` — AI verification → XP → leaderboard (NEW Activities)
    - `POST /api/activity/skip-task` — skip task, 0 XP
    - `POST /api/activity/claim-guest-xp` — replay guest trial claims after sign-in
    - `POST /api/admin/activity` — admin CRUD for Activities (strict email check)
    - `POST /api/admin/task` — admin CRUD for Tasks (strict email check)
    - `POST /api/admin/cloudinary-sign` — signed Cloudinary upload (admin only)
  - **Key internal functions:** `verifyFirebaseIdToken()`, `createServiceAccountJwt()`, `getAccessToken()` (caches Firestore access token), `fsGet/fsRunQuery/fsCreateDoc/fsPatch` (Firestore REST wrappers), `toFirestoreValue/fromFirestoreValue`, `supabaseRequest/supabaseAdminRequest`, `verifyWithAI()` (keyword heuristic + spam detection), `awardActivityXp()` (idempotent per grantKey, updates user doc + 4 leaderboards), `evaluateBadgesDelta()`, `logTaskProgress()` (best-effort Supabase write), `handleCompleteTask/handleSkipTask/handleClaimGuestXp/handleAdminActivity/handleAdminTask/handleCloudinarySign/handleAwardXp/handleBumpStreak/handleUseShield`, `upsertLeaderboard()`.
- **Imports/Exports:** ES module default export `{ async fetch(request, env) }`. Uses `env.FIREBASE_KEYS` (KV binding for private key), `env.FIREBASE_SA_CLIENT_EMAIL`, `globalThis.ADMIN_EMAILS/SUPABASE_URL/SUPABASE_ANON_KEY/CLOUDINARY_*`. No JS imports.
- **Secrets required (Wrangler):** `FIREBASE_SA_CLIENT_EMAIL`, `FIREBASE_SA_PRIVATE_KEY` (in KV `FIREBASE_KEYS`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- **If it breaks:** All gamification and Activity operations fail — XP awards, streak bumps, task completion/skip, admin CRUD, Cloudinary signing. Auth (Firebase Auth) and basic Firestore reads still work. Frontend shows errors or degrades gracefully.

**`workers/gamification-cron.js`** (333 lines)
- **Purpose:** `trio-gamification-cron` Worker. Scheduled (cron) cleanup + daily question publishing.
  - **Crons:** `0 * * * *` (hourly — delete expired posts/stories/voice from Firestore + Cloudinary, delete expired tempChats), `15 0 * * *` (daily 00:15 UTC — publish `config/dailyQuestion`).
  - **Functions:** `publishDailyQuestion()` (picks deterministic question from `DAILY_QUESTIONS` array by date hash), `deleteExpiredPosts()` (queries Firestore for `expiresAtMs < now`, deletes from Cloudinary then Firestore, max 200/run), `deleteExpiredTempChats()`, `deleteFromCloudinary()` (SHA-1 signature), `createServiceAccountJwt/getAccessToken` (same pattern as gamification.js).
- **Imports/Exports:** ES module default export `{ async fetch(), async scheduled(event, env, ctx) }`.
- **Secrets:** `FIREBASE_PROJECT_ID`, `FIREBASE_SA_CLIENT_EMAIL`, `FIREBASE_SA_PRIVATE_KEY` (KV), `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- **If it breaks:** Expired stories/voice posts are not auto-deleted (accumulate in Firestore + Cloudinary). Daily question is not published. No impact on real-time user flows.

**`workers/media-upload.js`** (255 lines)
- **Purpose:** `trio-media-upload` Worker. `POST /media/sign` — generates Cloudinary signed upload parameters. Verifies Firebase ID token, rate-limits 20 signatures/min/UID, controls all Cloudinary parameters (folder, public_id, resource_type, allowed formats, max file size) — client cannot override.
  - **Upload kinds:** `story_image` (folder `trio/stories`, jpg/jpeg/png/webp, ≤12 MB, overwrite:false), `story_video` (folder `trio/stories`, mp4/mov/webm, ≤100 MB, overwrite:false), `profile` (folder `trio/profiles`, jpg/jpeg/png/webp, ≤8 MB, overwrite:true, publicId `{uid}_avatar`).
  - **Signature:** SHA-1 of alphabetically sorted params + `CLOUDINARY_API_SECRET`.
- **Imports/Exports:** ES module default export `{ async fetch(request, env) }`. Imports `corsHeaders, json, isAllowedOrigin` from `./shared/cors.js`.
- **Secrets:** `FIREBASE_PROJECT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- **If it breaks:** Media uploads (stories, profile photos) cannot get signed params. Falls back to Firebase Storage in `image-upload.js` (`uploadToStorageFallback`). App degrades but uploads still work via fallback.

**`workers/send-notification.js`** (642 lines)
- **Purpose:** `trio-notifications` Worker. `POST /notifications/create` — server-authoritative notification creation. Verifies Firebase ID token, verifies the action exists (like/comment/share/connect/message/badge_earned/challenge_reminder), checks user notification settings, writes notification doc to `users/{targetUid}/notifications`, sends OneSignal push if user has `oneSignalId`. Rate limit 20/min/UID. Max body 8KB.
- **Imports/Exports:** ES module default export `{ async fetch(request, env, ctx) }`. Imports `corsHeaders, json, isAllowedOrigin` from `./shared/cors.js`.
- **Secrets:** `FIREBASE_PROJECT_ID`, `FIREBASE_SA_CLIENT_EMAIL`, `FIREBASE_SA_PRIVATE_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.
- **If it breaks:** Notifications are not created server-side. `createNotificationViaWorker()` in frontend catches errors silently (best-effort). In-app notification bell still reads from Firestore directly.

**`workers/shared/cors.js`** (40 lines)
- **Purpose:** Shared CORS helpers deduplicated across Workers (was duplicated in gamification.js + send-notification.js). Defines `ALLOWED_ORIGINS` (4 prod origins), `LOCAL_HOSTS`, `isAllowedOrigin()`, `corsHeaders()`, `json()`.
- **Imports/Exports:** ES module exports `ALLOWED_ORIGINS`, `isAllowedOrigin`, `corsHeaders`, `json`. Imported by `send-notification.js` and `media-upload.js`. NOTE: `gamification.js` has its own inline copy (not using this shared module — potential drift).
- **If it breaks:** Workers that import it fail to load. CORS headers missing → browser blocks cross-origin requests from frontend.

---

#### 1.2.3 Firebase Functions

**`functions/index.js`** (121 lines)
- **Purpose:** Firebase Functions v2 HTTPS callable `signInWithTrioUid` (region `us-central1`). The ONLY Trio UID sign-in path. Validates `trioUid` format (`^TRIO-[A-Z0-9]{8}$`), rate-limits per Trio UID (5 attempts / 10 min via `authRateLimits` collection), looks up `users` collection by `userId`, gets Firebase Auth user by UID, rejects Google-only accounts (no email), calls Google Identity Toolkit `signInWithPassword` with the user's email + password, returns a Firebase custom token (`trioLogin: true`). Client then calls `signInWithCustomToken(auth, customToken)`.
- **Imports/Exports:** CommonJS. Imports `firebase-admin/firestore`, `firebase-admin`, `crypto`, `firebase-functions/v2/https`. Exports `signInWithTrioUid`. Initializes `admin.initializeApp()`, `db = getFirestore()`. Hardcodes `FIREBASE_WEB_API_KEY = 'AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA'` (public web API key, not a secret).
- **If it breaks:** Trio UID login (`/login` with UID tab) fails entirely. Email/password and Google login still work (they go directly to Firebase Auth SDK, not this callable).

**`functions/package.json`**
- **Purpose:** Firebase Functions dependencies: `firebase-admin ^11.11.1`, `firebase-functions ^6.0.0`, Node 20 engine.
- **If it breaks:** `firebase deploy --only functions` fails.

---

#### 1.2.4 Frontend — Core Bootstrap & Auth

**`public/firebase-config.js`** (12 lines)
- **Purpose:** Single source of truth for Firebase config object. `apiKey: "AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA"`, `authDomain: "nkm-ind.firebaseapp.com"`, `projectId: "nkm-ind"`, `storageBucket: "nkm-ind.firebasestorage.app"`, `messagingSenderId: "180091505382"`, `appId: "1:180091505382:web:b16a35ddaa3dea38fd4927"`, `measurementId: "G-208ZD5YZL9"`.
- **Imports/Exports:** ES module exports `firebaseConfig`. Imported by `firebase-init.js` and `firebase-auth.js`.
- **If it breaks:** All Firebase initialization fails. Auth, Firestore, Storage, Functions — everything Firebase-related breaks. App is non-functional.

**`public/firebase-init.js`** (9 lines)
- **Purpose:** Full Firebase initialization (Auth + Firestore) for app pages. Initializes app, exports `app`, `db = getFirestore(app)`, `auth = getAuth(app)`.
- **Imports/Exports:** Imports from `firebase-config.js` and Firebase SDK CDN (v10.13.0). Exports `app`, `db`, `auth`.
- **If it breaks:** Any page importing `./firebase-init.js` fails to load. Most of the app (Today, Profile, Chat, Leaderboard, etc.).

**`public/firebase-auth.js`** (7 lines)
- **Purpose:** Lightweight Firebase init (Auth only) for the login page, avoiding the 102 KiB Firestore SDK.
- **Imports/Exports:** Imports `firebase-config.js`. Exports `app`, `auth`.
- **If it breaks:** `login.html` cannot initialize Firebase Auth. Login/signup non-functional.

**`public/auth.js`** (439 lines)
- **Purpose:** Login/signup page logic. Handles email/password signup (`createUserWithEmailAndPassword`), email/password login (`signInWithEmailAndPassword`), Google (`signInWithPopup`/`signInWithRedirect`), Trio UID login via Firebase Callable (`loginWithTrioUid` → `signInWithTrioUid` → `signInWithCustomToken`), password reset (`sendPasswordResetEmail`). Client-side rate limiting (5 failures / 10 min in localStorage). Calls `saveUserProfile()` after sign-in to create/heal `users/{uid}` Firestore doc. Generates `userId`/`trioUid` (`TRIO-XXXXXXXX`) via `makeUserId()` on first profile creation only (set-once, protected by Firestore rules). Mirrors email to `usersPrivate/{uid}` (best-effort, non-blocking).
- **Imports/Exports:** Imports `auth` from `./firebase-auth.js`, Firebase Auth SDK from CDN, `makeUserId` from `./utils.js`. No exports (script module with side effects).
- **If it breaks:** Login page non-functional. No user can sign in or sign up. Existing sessions (if any) still work until token expiry.

**`public/auth-guard.js`** (67 lines)
- **Purpose:** Central authentication gate for protected pages. Listens to `onAuthStateChanged`. If no user on a protected page, redirects to `login.html?redirect=<current>`. Public pages (root, index, activity-player, 404, sitemap, offline, privacy, privacy-policy, terms, help, login) are accessible without auth. Also triggers self-heal of `users/{uid}` via `ensureUserProfile()` on every authenticated session (fire-and-forget). 15-second fallback redirect if Firebase never resolves.
- **Imports/Exports:** Imports `auth` from `./firebase-init.js`, `onAuthStateChanged` from CDN. No exports.
- **If it breaks:** Protected pages either show to unauthenticated users (security hole) or redirect logged-in users to login (lockout). App effectively broken for authenticated flows.

**`public/auth-preload.js`** (18 lines)
- **Purpose:** Early auth gate — hides page body (`visibility:hidden`) with a spinner overlay before Firebase resolves, preventing flash of protected UI. Sets `dataset.authRequired='true'` and class `auth-pending`.
- **Imports/Exports:** None. Self-executing IIFE.
- **If it breaks:** No functional impact; users may see a brief flash of content before auth resolves.

**`public/auth-ui.js`** (357 lines)
- **Purpose:** Global auth chrome — single renderer for `#authStatus` across all pages. On auth state change: renders header chip (streak badge, weekly XP, avatar), checks admin status (hardcoded emails + `config/admins` Firestore doc), sets nav admin flag, dispatches `trio-auth-status-rendered` event, starts notification listeners (`listenForNotifications`, `listenForAlerts`), enables OneSignal push, sets up chat unread dots (`markChatSeen`, `isChatUnread`, collection-group following/followers listeners). Handles logout via `signOut`.
- **Imports/Exports:** Imports `auth, db` from `./firebase-init.js`, `trioCache`, `utils`, `notifications`, `userCache`, `onesignal`, `ui/nav`. Firebase Auth/Firestore SDK from CDN. No exports (side effects + `window.TrioAuthStatus`, `window.TrioChatUnread`).
- **If it breaks:** Header auth chip missing, no notification bell, no chat unread indicators, no OneSignal init, admin nav not shown. Core app functions still work but chrome is degraded.

---

#### 1.2.5 Frontend — Page Modules

**`public/index.html`** + **`public/today-activity.js`**
- **Purpose:** Today (Activities Dashboard). Three views: Guest View (3 free starter activities, progress in localStorage), Logged-in Onboarding (5 goal cards), Dashboard (category-specific activity cards). Language toggle EN/HI in localStorage. Renders Brain Sprint (60-second quiz, no Firestore), Trio Pulse (daily question, blur-unlock habit loop), Story Strip, Focus & Continue, Active Challenges, People (leaderboard-based). `trioPulse` blur-unlock: cards stay blurred until user saves their own answer for today.
- **Imports:** `firebase-init.js`, `notifications`, `image-upload`, `trio-cache`, `userCache`, `sound-manager`, `utils`, `gamification/community-tasks`, `services/infiniteChallenges`.
- **If it breaks:** Root page `/` non-functional. Users cannot see Today dashboard, activities, or onboarding.

**`public/activity-player.html`** + **`public/activity-player.js`**
- **Purpose:** Task Player. Fetches activity + tasks from Supabase. Progress bar, per-task type badge/XP/timer/proof textarea. Complete → sends proof to gamification Worker → AI verification → awards XP + leaderboards. Skip → 0 XP, logged server-side. Completion screen with total XP. Guest trial: 3 tasks max, then login modal.
- **Imports:** `firebase-init.js`, `gamification/worker-config`, `utils`, `trio-cache`.
- **If it breaks:** Activity task completion non-functional. Core product feature broken.

**`public/profile.html`** + **`public/profile.js`**
- **Purpose:** You/Profile page. Identity (photo, name, bio, Trio UID), gamification (XP, level, streaks, badges, progress), followers/following, theme controls, logout. Calls `ensureUserProfile()` if doc missing.
- **Imports:** `firebase-init.js`, `userCache`, `utils`, `trio-cache`, `sound-manager`.
- **If it breaks:** Profile page non-functional. Logout button missing (handled in auth-ui.js as fallback).

**`public/leaderboard.html`** + **`public/leaderboard.js`**
- **Purpose:** Leaderboard. Top-3 Podium (Gold center, Silver left, Bronze right, floating cards with animations). Full ranking by weekly XP. Tabs: Global XP, Weekly, Monthly, Streak. Current user highlighted.
- **Imports:** `firebase-init.js`, `trio-cache`, `utils`.
- **If it breaks:** Leaderboard page non-functional. Read-only degradation (shows empty/cached).

**`public/chat.html`** + **`public/chat.js`**
- **Purpose:** Chat inbox (conversation list). Private one-to-one conversations. Unread indicators.
- **Imports:** `firebase-init.js`, `userCache`, `utils`, `trio-cache`.
- **If it breaks:** Chat inbox non-functional.

**`public/private-chat.html`** + **`public/private-chat.js`**
- **Purpose:** 1:1 private conversation (web). `chatId = [uid1, uid2].sort().join('_')`. Messages in `privateChats/{chatId}/messages`. Delete own messages. Seen tracking.
- **Imports:** `firebase-init.js`, `userCache`, `utils`, `notifications`.
- **If it breaks:** Private messaging non-functional on web.

**Android local chat — `android/app/src/main/java/com/trioday/app/ChatDatabase.kt`**
- **Purpose:** On-device SQLite store (`trio_day_chat.db`) for Android private chat messages only.
- **Scope:** Chat messages only — never account, profile, activity, XP, or connection data.
- **Auto-cleanup:** Messages older than 30 days are deleted from the local SQLite database. This cleanup applies **only to chat messages**; the database file itself is never auto-deleted by the app.
- **User control:** The SQLite database file is under user control. It is removed only when the user uninstalls the app or clears app data (Android Settings → Apps → Trio Day → Storage → Clear data). The app never deletes it.
- **If it breaks:** Android chat falls back to no local persistence; messages still sync via Firestore `privateChats/{chatId}/messages`.

**`public/all-users.html`** + **`public/all-users.js`**
- **Purpose:** Discover — user directory with avatars, names, XP, categories. Streak leaderboard. "Challenge them" links.
- **Imports:** `firebase-init.js`, `userCache`, `utils`, `trio-cache`.
- **If it breaks:** Discover page non-functional.

**`public/search.html`** + **`public/search.js`**
- **Purpose:** People / activity search.
- **Imports:** `firebase-init.js`, `userCache`, `utils`.
- **If it breaks:** Search page non-functional.

**`public/settings.html`** + **`public/settings.js`**
- **Purpose:** User settings.
- **Imports:** `firebase-init.js`, `userCache`.
- **If it breaks:** Settings page non-functional.

**`public/notifications.html`** + **`public/notifications.js`**
- **Purpose:** Notification center. Reads `users/{uid}/notifications` subcollection. Mark as read.
- **Imports:** `firebase-init.js`, `userCache`, `utils`.
- **If it breaks:** Notification center non-functional. Bell in header still works via auth-ui.js.

**`public/admin-activity.html`** + **`public/admin-activity.js`**
- **Purpose:** Admin Activity/Task management. Strict admin check (Firebase token email must match `ADMIN_EMAILS`). Activities CRUD + Tasks CRUD + Cloudinary signed upload for cover images (`trio/activities` folder, `f_auto,q_auto,c_fill,g_auto,w_800`).
- **Imports:** `firebase-init.js`, `gamification/worker-config`, `utils`.
- **If it breaks:** Admin panel non-functional. Only affects users with admin emails.

**`public/404.html` / `public/sitemap.html` / `public/help.html` / `public/privacy.html` / `public/terms.html`**
- **Purpose:** Static informational pages. Public (no auth required).
- **If it breaks:** Those specific pages show errors or blank.

**`public/manifest.json` / `public/favicon.ico` / `public/robots.txt`**
- **Purpose:** PWA manifest, site icon, crawler directives.
- **If it breaks:** PWA installability and SEO slightly degraded.

---

#### 1.2.6 Frontend — Shared Modules

**`public/utils.js`** (63 lines)
- **Purpose:** Shared utilities — single source for `makeUserId()` (TRIO-XXXXXXXX hash from Firebase UID), `escapeHtml()`, `initials()`, `formatTime()`, `nameOf()`, `timeOf()`, `chatId()` (sorted join), `avatarHtml()`, `getFilterCSS()` (vivid/warm/cool/bw/retro/cinematic), `cloudinaryAutoUrl()` (inserts `f_auto,q_auto` into Cloudinary secure_url).
- **Imports/Exports:** ES module exports all functions. Imported by `auth.js`, `script.js`, `image-upload.js`, `auth-ui.js`, `community-tasks.js`, `xp-levels.js`, and many page modules.
- **If it breaks:** Every page importing utils fails to load. App completely non-functional.

**`public/trio-cache.js`** (149 lines)
- **Purpose:** Central in-memory + localStorage cache with TTL. `get(key)` checks memory then localStorage. `set(key, data, ttl, lsPersist)`. `invalidate(key)`, `invalidatePrefix(prefix)`, `clear()`. TTL constants: SHORT 2min, DEFAULT 5min, LONG 10min. Auto-clears private prefixes on logout (`user_`, `profile_`, `connections_`, `posts_`, `connstate_`, `notif_`, `admin_`, `tasks_`, `progress_`, `my_rank_`).
- **Imports/Exports:** ES module exports `trioCache`. Imports `auth` from `./firebase-init.js` (for logout listener). Imported by `script.js`, `community-tasks.js`, `xp-levels.js`, `auth-ui.js`, `userCache.js`.
- **If it breaks:** Cache modules fail; app falls back to direct Firestore reads (slower but functional). Import errors break dependent modules.

**`public/sound-manager.js`** (125 lines)
- **Purpose:** Web Audio API sound effects. `SoundManager.init()`, `click()`, `send()`, `delete()`, `like()`, `success()` (fanfare), `achievement()`, `storyTap()`, `moodSelect()`. Global click fallback tone. AudioContext resume on first gesture.
- **Imports/Exports:** ES module exports `SoundManager`. No imports.
- **If it breaks:** No sound effects. Silent degradation; no functional impact.

**`public/theme.js`**
- **Purpose:** Dark/light theme controls.
- **If it breaks:** Theme toggle non-functional. Default theme persists.

**`public/pwa-retire.js`**
- **Purpose:** Unregisters every non-OneSignal service worker and clears Cache Storage on page load. Only OneSignal push workers (`public/push/onesignal/`) run.
- **If it breaks:** Stale service workers may persist; caching issues. No core functional impact.

**`public/webmcp.js`** (105 lines)
- **Purpose:** WebMCP — read-only navigation helpers for in-browser AI agents. Registers tools: `open_today`, `open_challenge`, `search_challenges`, `find_people`, `open_chat`, `open_profile`. Only runs if `modelContext.registerTool` exists.
- **Imports/Exports:** None. Self-executing with feature detection.
- **If it breaks:** AI agent navigation tools unavailable. Human UI unaffected.

**`public/image-upload.js`** (256 lines)
- **Purpose:** Cloudinary signed upload client. `compressImageFile()` (browser WebP compression, maxEdge 1280, maxBytes 850KB), `getSignedParams()` (calls media-upload Worker with Firebase ID token), `uploadSignedBlob()` / `uploadSignedVideo()` (POST FormData to Cloudinary), `uploadToStorageFallback()` (Firebase Storage `uploads/{uid}/{fileName}` when Cloudinary unavailable), `uploadStoryMedia(uid, file, token, signal)` (story media, original quality, 24h short-term), `uploadProfileImage(uid, file, token, signal)` (profile photo, 640px, 500KB). Default signer URL: `https://trio-media-upload.trioday-nikhil.workers.dev/media/sign`.
- **Imports/Exports:** ES module exports `compressImageFile`, `uploadStoryMedia`, `uploadProfileImage`, `uploadToStorageFallback`, `cloudinaryAutoUrl`. Imports `auth` from `./firebase-init.js`, `cloudinaryAutoUrl` from `./utils.js`. Dynamically imports `firebase-storage` from CDN.
- **If it breaks:** Media uploads (stories, profile photos) non-functional. App degrades to text-only.

**`public/onesignal.js`** (172 lines)
- **Purpose:** OneSignal push SDK init. `enableOneSignalPush(user)` — loads SDK (`cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`), initializes with `ONESIGNAL_APP_ID`, service worker at `push/onesignal/OneSignalSDKWorker.js`, requests permission, calls `OneSignal.login(user.uid)`, waits for subscription ID, saves via `saveOneSignalId(uid, oneSignalId)` to `users/{uid}` Firestore doc. Skips on localhost (`isLocalHost()`). Session guard prevents re-init.
- **Imports/Exports:** ES module exports `enableOneSignalPush`, `saveOneSignalId`. Imports `db` from `./firebase-init.js`, `ONESIGNAL_APP_ID` from `./onesignal-config.js`, Firestore SDK from CDN.
- **If it breaks:** Push notifications unavailable. In-app notifications (Firestore listener) still work.

**`public/onesignal-config.js`** (9 lines)
- **Purpose:** Public OneSignal config. `ONESIGNAL_APP_ID = "ae462d86-13fe-48d1-a577-a484f539f4cb"`, `PUSH_API_URL`, `APP_BASE`.
- **Imports/Exports:** ES module exports `ONESIGNAL_APP_ID`, `PUSH_API_URL`, `APP_BASE`, `siteBasePath()`. Imported by `onesignal.js`, `notifications.js`.
- **If it breaks:** OneSignal init fails (wrong app ID). Push notifications unavailable.

**`public/push/onesignal/OneSignalSDKWorker.js`**
- **Purpose:** OneSignal push service worker (third-party SDK, not app-controlled).
- **If it breaks:** Push notifications unavailable. No app impact.

---

#### 1.2.7 Frontend — Gamification Modules

**`public/gamification/worker-config.js`** (74 lines)
- **Purpose:** Gamification Worker URL resolver + `workerPost(path, body, user)`. Default URL: `https://trio-gamification.trioday-nikhil.workers.dev`. Override via `window.__TRIO_CONFIG__.gamificationWorkerUrl`. Gets Firebase ID token (`user.getIdToken(false)`), retries once with fresh token on 401.
- **Imports/Exports:** ES module exports `getGamificationWorkerUrl()`, `workerPost()`. No imports.
- **If it breaks:** All gamification Worker calls fail. XP awards, streak, task completion non-functional.

**`public/gamification/xp-levels.js`** (64 lines)
- **Purpose:** `awardXp(uid, amount, meta)` — calls Worker `/gamification/award-xp` via `workerPost`. Includes user timezone. Invalidates `my_rank_${uid}` and `user_${uid}` cache. Dispatches `trio-xp-changed` event. Announces badges via `ui/achievements.js`.
- **Imports/Exports:** ES module exports `awardXp`, `levelFromXp`. Imports `auth` from `firebase-init.js`, `levelFromXp/getUserTimeZone` from `constants.js`, `workerPost` from `worker-config.js`, `trioCache`, `announceBadgesEarned` from `ui/achievements.js`.
- **If it breaks:** XP awarding non-functional. User cannot earn XP via frontend.

**`public/gamification/constants.js`** (78 lines)
- **Purpose:** Shared constants: `XP_PER_LEVEL=100`, `LEADERBOARD_TOP_N=50`, `NOTIF_TYPES`, `SYSTEM_BADGES` (6 badges), timezone helpers (`getUserTimeZone`, `localDateKey`, `localWeekKey`, `localMonthKey`, `yesterdayDateKey`), `levelFromXp()`.
- **Imports/Exports:** ES module exports all constants and functions. Imported by `xp-levels.js`, `streaks.js`, etc.
- **If it breaks:** Gamification modules fail to load.

**`public/gamification/community-tasks.js`** (206 lines)
- **Purpose:** Firestore CRUD for community challenges (`communityTasks` collection). `listCommunityTasks()` (query by status/kind, filter by date range, cache in trioCache), `getCommunityTask()`, `createCommunityTask()` (validated payload, 2-5 options, 7-40 days expiry, xpReward 25), `joinTask()`/`leaveTask()` (members subcollection), `getMyJoinedTaskIds()` (collection-group query on `members`), `setChallengeFeature()`/`setChallengeHidden()`/`removeChallenge()`/`archiveTask()`/`expireOldTasks()`.
- **Imports/Exports:** ES module exports all functions. Imports `db, auth` from `firebase-init.js`, Firestore SDK from CDN, `trioCache`.
- **If it breaks:** Community challenge listing/creation/joining non-functional.

**`public/gamification/leaderboards.js` / `streaks.js` / `badges.js`**
- **Purpose:** Leaderboard, streak, and badge helper modules for frontend display.
- **If it breaks:** Related UI features degrade or fail.

---

#### 1.2.8 Frontend — Services

**`public/services/userCache.js`** (120 lines)
- **Purpose:** Single source for user/profile caching (replaces 6 duplicated families). `getCachedUser(uid)` (cached Firestore `users/{uid}` fetch, TTL 5min), `getCachedUserProfile` (alias), `getMyProfile(uid)`, `findUserCached(uid)` (direct + fallback collection query), `ensureUserProfile(authUser, chosenName)` (Phase 1 self-heal: creates `users/{uid}` with displayName, name, userId/trioUid, bio, photoURL, emailHidden, createdAt/updatedAt; email scrubbed to `usersPrivate`). Gamification fields intentionally NOT seeded (Worker-owned).
- **Imports/Exports:** ES module exports `getCachedUser`, `getCachedUserProfile`, `getMyProfile`, `findUserCached`, `ensureUserProfile`. Imports `db` from `../firebase-init.js`, Firestore SDK from CDN, `trioCache`, `makeUserId` from `../utils.js`.
- **If it breaks:** Profile fetching and self-heal fail. `/profile` shows "User not found" for new users. Header shows no XP/streak.

**`public/services/notifications.js`** (merged from notificationHelpers + notificationWorker + notificationSettings)
- **Purpose:** Single source for all notification-related logic: `notifyUser()`, `pushCopy()`, `pushUrl()`, `notificationText()`, `createNotificationViaWorker()`, `notifyUserViaWorker()`, `getNotificationWorkerStatus()`, `loadNotificationSettings()`, `renderNotificationSettings()`, `saveNotificationSetting()`, `initNotificationSettingsUI()`. Routes notification creation through the Cloudflare Worker (`trio-notifications`). Manages user notification preferences in Firestore.
- **Imports/Exports:** ES module exports all notification functions. Imports `auth, db` from `../firebase-init.js`, `trioCache` from `../trio-cache.js`, `SoundManager` from `../sound-manager.js`, `APP_BASE` from `../onesignal-config.js`, Firebase Auth/Firestore SDK from CDN.
- **If it breaks:** Notification creation via Worker unavailable; falls back silently. Notification settings UI non-functional.

**`public/services/infiniteChallenges.js`**
- **Purpose:** Brain Sprint challenge bank (no Firestore reads). Cached in sessionStorage with OpenTDB fallback.
- **If it breaks:** Brain Sprint quiz non-functional on Today page.

---

#### 1.2.9 Frontend — UI Components

**`public/ui/nav.js`** (162 lines)
- **Purpose:** Global navigation. Base items: Today, Leaderboard, Chat, You. Admin item conditionally added. Bottom nav (mobile) + desktop rail. `setAdminFlag(flag)` updates `document.body.dataset.isAdmin` and dispatches `trio-admin-status-change`. `renderNav()` called on boot with multiple retries (0ms, 250ms, 1000ms) and on resize.
- **Imports/Exports:** ES module exports `setAdminFlag`, `renderNav`, `navHtml`. No imports.
- **If it breaks:** Navigation not rendered. Users cannot navigate between pages.

**`public/ui/header.js`** (170 lines)
- **Purpose:** Global header wiring. Enhances `.topbar` markup, adds search slot, sheet wiring, theme toggle, notification bell (Today-only), Trio logo, first-paint loader. Injects `experience-v2.css/js`, `core-loop.js`, `webmcp.js` at runtime. Dispatches `trio-header-ready`.
- **Imports/Exports:** ES module exports `initHeader`. Imports `attachSearch` from `./search.js`.
- **If it breaks:** Header chrome missing (no logo, no search, no notifications button, no theme toggle). Pages still functional.

**`public/ui/sheet.js` / `ui-kit.js` / `achievements.js` / `search.js`**
- **Purpose:** UI components: bottom sheets (sheet.js), toasts + skeletons (ui-kit.js — merged from toast.js + skeleton.js), achievement popups (achievements.js), search typeahead (search.js).
- **If it breaks:** Related UI components degrade; core app functions intact.

---

#### 1.2.10 Scripts

**`scripts/migrate-base64-to-storage.mjs`** (228 lines)
- **Purpose:** Offline migration script. Migrates base64/data-URL images from Firestore → Cloudinary. Targets `users/{uid}.photoURL` → `trio/profiles`, `posts/{id}.mediaUrl`/`photoURL` → `trio/posts`. Uses Firebase Admin SDK with service account JSON (`scripts/serviceAccountKey.json`, gitignored). `--dry-run`, `--posts-only`, `--users-only` flags.
- **Imports/Exports:** Node ESM script. Imports `fs`, `path`, `url`, `firebase-admin`. No exports.
- **If it breaks:** Migration cannot run. Existing base64 images remain in Firestore (bloat).

**`scripts/validate-repo.mjs`** (68 lines)
- **Purpose:** Release checks. Walks `public/`, syntax-checks all `.js` files via `node --check`, validates HTML `href`/`src` references resolve locally, validates `firestore.indexes.json` and `firebase.json` parse as JSON.
- **Imports/Exports:** Node ESM script. No exports.
- **If it breaks:** `npm run validate` unavailable. No runtime impact.

---

## 2. COMPLETE DATABASE & DATA FLOW MATRIX

### 2.1 Databases & External Services Used

| Service | Purpose | Project/Instance | Connection Initialized Where |
|---------|---------|-----------------|------------------------------|
| **Firebase Authentication** | User auth (email/password, Google, Trio UID via custom token) | `nkm-ind` | `firebase-auth.js` / `firebase-init.js` (`getAuth(app)`) |
| **Cloud Firestore** | NoSQL document database — all app data | `nkm-ind` | `firebase-init.js` (`getFirestore(app)`) |
| **Firebase Storage** | Fallback media storage (Cloudinary unavailable) | `nkm-ind` | Dynamically imported in `image-upload.js` (`getStorage()`) |
| **Firebase Functions (v2)** | `signInWithTrioUid` callable (Trio UID login) | `nkm-ind`, region `us-central1` | `functions/index.js` (`admin.initializeApp()`) |
| **Supabase (PostgreSQL)** | Activity/Task definitions (`activities`, `tasks`, `user_task_progress`) | `vccypxwiqcuexxrhtgyq` | `workers/gamification.js` via REST (`supabaseRequest()`) |
| **Cloudinary** | Media storage/optimization (stories, profile photos, activity covers) | Cloud name `vyhglthg` | `workers/media-upload.js` (signing) + client POST to `api.cloudinary.com` |
| **OneSignal** | Push notifications | App ID `ae462d86-...` | `public/onesignal.js` (SDK) + `workers/send-notification.js` (REST API) |

### 2.2 Auth Flow — Login/Signup Files & Password Storage

**Files handling login/signup:**
1. `public/login.html` — UI markup for the login/signup form
2. `public/auth.js` — All login/signup logic (439 lines)
3. `public/firebase-auth.js` — Firebase Auth SDK initialization (light)
4. `public/firebase-config.js` — Firebase project config
5. `functions/index.js` — `signInWithTrioUid` callable (Trio UID login backend)
6. `public/auth-guard.js` — Post-login redirect + protected page gating
7. `public/auth-ui.js` — Post-auth header chrome + session self-heal

**Password storage:**
- **Passwords are NOT stored in Firestore.** They are stored exclusively in **Firebase Authentication** (Google's managed identity platform).
- User details (name, photoURL, bio, Trio UID, etc.) are stored in **Firestore** collection `users/{uid}`.
- Private email mirror stored in `usersPrivate/{uid}` (owner-only read/write).

**Auth methods supported:**
| Method | Flow | File |
|--------|------|------|
| Email/Password Signup | `createUserWithEmailAndPassword(auth, email, password)` → `updateProfile(user, {displayName: name})` → `saveUserProfile()` | `auth.js:358-361` |
| Email/Password Login | `signInWithEmailAndPassword(auth, email, password)` → `saveUserProfile()` | `auth.js:366-367` |
| Google Sign-In | `signInWithPopup(auth, new GoogleAuthProvider())` → `saveUserProfile(result.user)` | `auth.js:193-212` |
| Trio UID Login | Client validates format → calls Firebase Callable `signInWithTrioUid` → Functions looks up `users` by `userId` → gets Auth user email → calls Google Identity Toolkit `signInWithPassword` → returns custom token → `signInWithCustomToken(auth, customToken)` | `auth.js:216-265` + `functions/index.js:64-121` |
| Password Reset | `sendPasswordResetEmail(auth, email)` | `auth.js:309-318` |

**Trio UID format:** `^TRIO-[A-Z0-9]{8}$` (e.g., `TRIO-AB12CD34`). Generated by `makeUserId()` in `utils.js` (FNV-1a hash of Firebase UID + salt).

**`users/{uid}` document schema (Firestore):**
```json
{
  "uid": "firebase_auth_uid",
  "name": "Display Name",
  "displayName": "Display Name",
  "userId": "TRIO-XXXXXXXX",        // set-once, protected by Firestore rules
  "trioUid": "TRIO-XXXXXXXX",        // duplicate of userId
  "photoURL": "https://...cloudinary...",  // or null
  "bio": "",
  "emailHidden": false,
  "email": "[DELETE_FIELD]",         // scrubbed from public doc; lives in usersPrivate
  "createdAt": serverTimestamp(),
  "updatedAt": serverTimestamp(),
  // Gamification fields — WRITE-PROTECTED from clients (Worker-only):
  "xp": 0,
  "level": 1,
  "streakCurrent": 0,
  "streakBest": 0,
  "streakLastDate": null,
  "weeklyXp": 0,
  "monthlyXp": 0,
  "badges": [],
  "shields": 0,
  "selectedCategory": "...",
  "onboardingComplete": false,
  "oneSignalId": "...",
  "oneSignalIdUpdatedAt": "...",
  "guestXpClaimed": false,
  "guestTasksClaimed": 0,
  "guestClaimedAtMs": 0
}
```

**`usersPrivate/{uid}` document schema:**
```json
{
  "email": "user@example.com",
  "updatedAt": serverTimestamp()
}
```

**`authRateLimits/{sha256(trioUid)}` document (Functions rate limiting):**
```json
{
  "attempts": 3,
  "windowStartedAtMs": 1729400000000,
  "updatedAt": Timestamp
}
```

### 2.3 Data Schema — All Collections/Subcollections

| Path | Type | Who Writes | Key Fields | Rules |
|------|------|-----------|------------|-------|
| `users/{uid}` | Document | Client (owner), Worker (gamification fields) | name, userId, photoURL, bio, emailHidden, xp*, level*, streak*, weeklyXp*, monthlyXp*, badges*, shields*, oneSignalId | Read: all signed-in. Create/Update: owner only. Gamification fields: blocked for clients (`noGamificationWrite`). userId: set-once (`canChangeUserId`). Delete: disabled. |
| `users/{uid}/followers/{followerUid}` | Subcollection doc | Client (owner) | uid, userId, name, createdAt | Owner only |
| `users/{uid}/following/{followedUid}` | Subcollection doc | Client (owner) | uid, userId, name, createdAt | Owner only; followedId != self |
| `users/{uid}/notifications/{id}` | Subcollection doc | **Server only** (send-notification Worker) | type, actorUid, actorName, text, read, createdAtMs | Read: owner. Update: owner, only `read` field. Create: disabled (server-only). Delete: owner. |
| `users/{uid}/progress/{periodKey}` | Document | Client (owner) | period-specific progress data | Owner read/write |
| `users/{uid}/activityCompletions/{id}` | Document | Server only (gamification Worker) | activityId, taskId, status, userSubmission, aiVerified, xpAwarded, weekKey, completedAt | Read: owner. Create/Update/Delete: disabled. |
| `users/{uid}/xpAwards/{grantKey}` | Document | Server only (gamification Worker) | uid, grantKey, amount, createdAtMs | Idempotency key for XP awards |
| `usersPrivate/{uid}` | Document | Client (owner) | email, updatedAt | Owner only |
| `posts/{postId}` | Document | Client (owner, story/voice only) | type (story/voice), isStory/isVoice, message, mediaUrl, privacy (public/friends), allowedUids[], expiresAtMs, uid, name | Read: signed-in (visibility rules). Create: signed-in, validated (23-25h expiry). Update: disabled. Delete: owner. |
| `posts/{postId}/comments/{cid}` | Subcollection | Client | uid, txt, name | Read: signed-in + canReadStory. Create: signed-in + canReadStory. |
| `posts/{postId}/likes/{uid}` | Subcollection | Client | uid | Read/signed-in, create/delete: owner |
| `posts/{postId}/moods/{uid}` | Subcollection | Client | uid, mood | Read/signed-in, create/update/delete: owner |
| `challengeAnswers/{answerId}` | Document | Client (owner) | challengeId, uid, choice (int 0-4), createdAtMs | Read: all signed-in. Create/Update: owner, validated. |
| `challengeThreads/{challengeId}/messages/{msgId}` | Subcollection | Client | uid, name, text, createdAtMs | Read: signed-in. Create: owner. |
| `privateChats/{chatId}/messages/{msgId}` | Subcollection | Client (participant) | uid, name, userId, text, createdAtMs, createdAt, replyToStoryId, storyPreview, originalStoryText, seen | chatId = uid1_uid2 (sorted). Participant-only read/create/update/delete own. |
| `tempChats/{roomId}` | Document | Client | participants[2], challengeId, expireAt | 2 participants, expiry enforced. |
| `tempChats/{roomId}/tempMessages/{msgId}` | Subcollection | Client (participant) | uid, text, expireAt | Participant only, before expiry. |
| `dailyAnswers/{answerId}` | Document | Client (owner) | questionKey, answer (<=280 chars), createdAtMs | Read: signed-in. Create/Update: owner. |
| `config/{docId}` | Document | Console only (admins) | dailyQuestion, admins | Read: signed-in. Write: disabled. |
| `config/admins` | Document | Console | uids[], emails[] | Admin lookup for auth-ui.js |
| `config/dailyQuestion` | Document | Cron Worker (gamification-cron) | date, index, question, updatedAtMs, publishedAtMs | Published daily at 00:15 UTC |
| `badges/{badgeId}` | Document | Admin (isAdmin) | id, name, icon, desc | Read: signed-in. Write: admin only. |
| `leaderboards/{boardId}` | Document | **Server only** (gamification Worker) | entries[] (uid, name, photoURL, level, value) | Read: signed-in. Write: disabled for clients. |

### Local SQLite (Android chat only)

| Path | Type | Who Writes | Key Fields | Rules |
|------|------|-----------|------------|-------|
| `trio_day_chat.db` → `chat_messages` | Local SQLite table | App (owner) | id, peer_uid, uid, name, text, created_at_ms, seen, is_mine | Read/write: app only. Auto-cleanup: messages older than 30 days deleted. Database file never auto-deleted by app; removed only on uninstall or "Clear data". Chat messages only — never account/profile/activity/XP data. |

**Supabase tables (PostgreSQL):**

| Table | Key Fields | Access |
|-------|-----------|--------|
| `activities` | id (UUID), display_order, category, title_en, title_hi, description_en, description_hi, difficulty, total_xp, cover_image_url, is_guest_allowed, is_published, created_at, updated_at | Anon key reads; service role writes via Worker |
| `tasks` | id (UUID), activity_id (FK), task_number, task_type, title_en, title_hi, instructions_en, instructions_hi, verification_prompt, min_time_seconds, xp_reward, is_published, created_at, updated_at, UNIQUE(activity_id, task_number) | Anon key reads; service role writes via Worker |
| `user_task_progress` | id (UUID), firebase_uid, activity_id, task_id, status (completed/skipped), user_submission, ai_verified, ai_feedback, xp_awarded, week_key, completed_at, UNIQUE(firebase_uid, task_id, week_key) | Service role writes via Worker |
| `user_sync_meta` | firebase_uid (PK), selected_category, guest_xp_claimed, claimed_at | Guest trial sync metadata |

### 2.4 Data Travel — Frontend UI to Backend Database

#### Path A: Client → Firebase Auth → Firestore (Auth + Profile)
```
User enters credentials in login.html
  → auth.js calls Firebase Auth SDK (createUserWithEmailAndPassword / signInWithEmailAndPassword / signInWithPopup)
  → Firebase Auth returns user object (uid, email, displayName, photoURL)
  → auth.js calls saveUserProfile(user)
    → imports firebase-init.js (db, auth)
    → writes users/{uid} doc via setDoc(merge: true)  [Firestore]
    → writes usersPrivate/{uid} doc (email mirror)     [Firestore] (best-effort)
  → onAuthStateChanged triggers redirect to redirectTo page  [auth.js:415-418]
```

#### Path B: Client → Firebase Callable → Firebase Auth (Trio UID Login)
```
User enters TRIO-XXXXXXXX + password in login.html (UID tab)
  → auth.js calls loginWithTrioUid(trioUid, password)
    → imports firebase-functions (getFunctions, httpsCallable)
    → calls signInWithTrioUid({trioUid, password})  [Cloud Function us-central1]
      → functions/index.js validates format, rate-limits via authRateLimits
      → queries users collection where userId == trioUid  [Firestore]
      → admin.auth().getUser(uid) → gets email
      → rejects if Google-only (no email)
      → POST to identitytoolkit.googleapis.com signInWithPassword (email+password)
      → admin.auth().createCustomToken(uid, {trioLogin: true, trioUid})
    → returns customToken
  → auth.js calls signInWithCustomToken(auth, customToken)
  → Firebase Auth returns authenticated user
  → saveUserProfile() → Firestore users/{uid}
  → redirect
```

#### Path C: Client → Cloudflare Worker → Firestore + Supabase (Gamification/Activities)
```
User completes task in activity-player.js
  → calls workerPost('/api/activity/complete-task', {activityId, taskId, proof, timeZone})
    → POST https://trio-gamification.trioday-nikhil.workers.dev/api/activity/complete-task
    → headers: Authorization: Bearer <Firebase ID token>
  → gamification.js verifies JWT via Firebase public keys
    → extracts uid from token payload.sub
  → fetches task from Supabase: GET /rest/v1/tasks?id=eq.{taskId}  [Supabase REST]
  → fetches activity from Supabase: GET /rest/v1/activities?id=eq.{activityId}
  → verifyWithAI(proof, verification_prompt, title, instructions)  [heuristic keyword matching]
  → if valid: awardActivityXp({uid, amount, grantKey, timeZone})
    → creates Firestore doc users/{uid}/xpAwards/{grantKey}  [idempotency]
    → reads users/{uid}, patches xp, level, weeklyXp, monthlyXp, badges  [Firestore]
    → upserts 4 leaderboards: global, weekly_{weekKey}, monthly_{monthKey}, streak  [Firestore leaderboards/{boardId}]
  → logTaskProgress() → POST to Supabase user_task_progress  [best-effort]
  → returns {xp, level, leveledUp, badgesEarned}
  → activity-player.js shows completion screen
```

#### Path D: Client → Cloudflare Worker → Cloudinary (Media Upload)
```
User selects image/video in story modal
  → script.js calls uploadStoryMedia(uid, file, token)
    → image-upload.js compresses image (WebP, 1080px, 1MB)
    → getSignedParams('story_image', token) → POST to media-upload Worker
      → media-upload.js verifies Firebase ID token, rate-limits 20/min
      → generates Cloudinary signature (SHA-1 of sorted params + API_SECRET)
      → returns {signature, timestamp, cloudName, apiKey, uploadUrl, folder, publicId, ...}
    → POST FormData (file, api_key, timestamp, signature, folder, public_id, overwrite) to Cloudinary upload URL
    → Cloudinary returns secure_url
    → image-upload.js applies cloudinaryAutoUrl (f_auto,q_auto)
    → returns secure_url to caller
  → script.js writes post to Firestore posts/{postId} with mediaUrl
  → on failure: falls back to uploadToStorageFallback() → Firebase Storage uploads/{uid}/{fileName}
```

#### Path E: Client → Cloudflare Worker → OneSignal (Notifications)
```
User likes a story (script.js openStoryViewer)
  → notifyUser(targetUid, {type:'like', actorUid, actorName, postId})
    → notifications.js → createNotificationViaWorker
      → POST https://trio-notifications.trioday-nikhil.workers.dev/notifications/create
      → headers: Authorization: Bearer <Firebase ID token>
    → send-notification.js verifies token, verifies action exists (checks story/like in Firestore)
    → writes users/{targetUid}/notifications/{id}  [Firestore]
    → if targetUser.oneSignalId: POST to OneSignal REST API (push notification)
  → Returns {ok: true} or suppressed
```

#### Path F: Cron Worker → Firestore + Cloudinary (Cleanup)
```
gamification-cron triggered hourly (0 * * * *)
  → getAccessToken() via service account JWT → FirREST access token
  → deleteExpiredPosts(): queries posts where expiresAtMs < now
    → for each: deleteFromCloudinary(mediaUrl) → DELETE Firestore doc
  → deleteExpiredTempChats(): queries tempMessages where expireAt < now
    → deletes messages + rooms
  → Daily (15 0 * * *): publishDailyQuestion() → patches config/dailyQuestion
```

#### Path G: Android → Local SQLite (Chat Messages Only)
```
Android app (ChatScreen.kt / TrioSocialApi.kt)
  → ChatDatabase.init(context) opens trio_day_chat.db (SQLiteOpenHelper)
  → Table chat_messages (id, peer_uid, uid, name, text, created_at_ms, seen, is_mine)
  → Messages written/read locally via raw SQLite (no Firestore path for Android chat storage)
  → Auto-cleanup (ChatDatabase.cleanupOldMessages): deletes rows where created_at_ms < now - 30 days
    → Applies ONLY to chat_messages table — never account/profile/activity/XP/connection data
    → Never deletes the trio_day_chat.db file itself
  → Database file removed only on: app uninstall, or Android Settings → Apps → Trio Day → Storage → Clear data
```

---

## 3. WORKERS & BACKGROUND PROCESSES

### 3.1 Worker Inventory

| Worker Name | File | Deployment Command | Purpose | Endpoints |
|-------------|------|-------------------|---------|-----------|
| **trio-day** | `workers/site.js` | `wrangler deploy` (root wrangler.jsonc) | Static asset serving + SPA pretty-URL routing | Static assets (GET) |
| **trio-gamification** | `workers/gamification.js` | `wrangler deploy --config workers/wrangler.gamification.toml` | Server-authoritative gamification + Activities API | POST /gamification/*, POST /api/activity/*, POST /api/admin/* |
| **trio-gamification-cron** | `workers/gamification-cron.js` | `wrangler deploy --config workers/wrangler.gamification.toml` | Cron: expired post/voice cleanup, tempChat cleanup, daily question publishing | Cron triggers only (+ fetch health check) |
| **trio-media-upload** | `workers/media-upload.js` | `wrangler deploy --config workers/wrangler.media-upload.toml` | Cloudinary signed upload parameter generation | POST /media/sign |
| **trio-notifications** | `workers/send-notification.js` | `wrangler deploy --config workers/wrangler.notifications.toml` | Server-authoritative notification creation + OneSignal push | POST /notifications/create |

### 3.2 Communication Architecture

```
Browser (localhost or production)
    │
    ├──► Firebase Auth SDK (direct to googleapis.com)  [Auth]
    ├──► Firebase Firestore SDK (direct to firestore.googleapis.com)  [Database reads/writes]
    ├──► Firebase Functions (direct to cloudfunctions.net)  [Trio UID login callable]
    ├──► Cloudflare Worker: trio-gamification  [XP, streaks, tasks, admin, Cloudinary sign]
    │      Headers: Authorization: Bearer <Firebase ID Token>
    ├──► Cloudflare Worker: trio-media-upload  [Cloudinary signed params]
    │      Headers: Authorization: Bearer <Firebase ID Token>
    ├──► Cloudflare Worker: trio-notifications  [Notification creation]
    │      Headers: Authorization: Bearer <Firebase ID Token>
    ├──► Cloudinary API (direct, signed upload)  [Media bytes]
    └──► OneSignal SDK (direct to cdn.onesignal.com)  [Push subscription]
```

**Worker → Backend communication:**
- `gamification.js` → Firestore REST (`firestore.googleapis.com/v1/projects/nkm-ind/databases/(default)/documents`) using service account access token (obtained via JWT OAuth2 exchange).
- `gamification.js` → Supabase REST (`https://vccypxwiqcuexxrhtgyq.supabase.co/rest/v1/...`) using anon key (public reads) or service role key (admin writes/verification_prompt).
- `gamification.js` → Google OAuth2 (`oauth2.googleapis.com/token`) for service account access token.
- `gamification-cron.js` → Same Firestore REST + Cloudinary delete API.
- `media-upload.js` → No backend calls (signs locally with crypto.subtle).
- `send-notification.js` → Firestore REST + OneSignal REST API.

### 3.3 Worker Responsibilities Detail

**trio-gamification (gamification.js):**
- **Auth:** Every request must carry `Authorization: Bearer <Firebase ID token>`. Token verified against Firebase public keys (cached in Cache API for 1 hour). `uid` extracted from `payload.sub`.
- **Rate limiting:** In-memory `Map` per UID, 10 requests/minute. Resets on Worker cold start (not durable — acceptable for rate limiting).
- **CORS:** Allows production origins + localhost (`http:` + `localhost/127.0.0.1/[::1]`).
- **XP award (idempotent):** `grantKey = activity_{activityId}_task_{taskNo}_w_{weekKey}`. Creates `xpAwards/{grantKey}` doc — if already exists (409), returns `alreadyAwarded: true` without re-awarding. Prevents double-tap double XP.
- **Leaderboard updates:** After every XP award, upserts user entry into 4 leaderboard docs (`global`, `weekly_{weekKey}`, `monthly_{monthKey}`, `streak`). Top 50 entries kept, sorted by value desc.
- **Badges:** 6 system badges evaluated on XP/streak thresholds (`badge_first_complete`, `badge_streak_3/7/30`, `badge_xp_500/1000`).
- **AI verification:** `verifyWithAI()` — checks spam patterns (asdf, qwer, test, etc.), then keyword overlap between proof and task title/instructions. Requires ≥1 keyword match or ≥50 chars. Falls back to `valid: true` if no verification_prompt configured.
- **Admin routes:** `assertAdmin()` checks `tokenPayload.email` against `ADMIN_EMAILS` (hardcoded fallback + env var). Strict — no Firestore admin lookup in this Worker (unlike auth-ui.js which also checks `config/admins`).

**trio-gamification-cron (gamification-cron.js):**
- **Hourly (`0 * * * *`):** Deletes expired stories/voice posts (`expiresAtMs < now`) from Firestore + Cloudinary (destroy API). Deletes expired tempChats. Max 200 deletes per run.
- **Daily (`15 0 * * *`):** Publishes `config/dailyQuestion` with deterministic question selected by date hash from `DAILY_QUESTIONS` array (52 questions).
- **fetch handler:** Returns health check JSON.

**trio-media-upload (media-upload.js):**
- **POST /media/sign:** Verifies Firebase ID token. Rate limits 20 signatures/min/UID. Returns Cloudinary upload params (signature, timestamp, apiKey, folder, publicId, resourceType, allowedFormats, maxFileSize, uploadUrl). Client uploads bytes directly to Cloudinary (Worker never sees media bytes).
- **Upload kinds:** story_image (≤12MB), story_video (≤100MB), profile (≤8MB, overwrite, `{uid}_avatar`).

**trio-notifications (send-notification.js):**
- **POST /notifications/create:** Verifies Firebase ID token. Verifies action exists (e.g. for `like`, checks story exists and user has mood on it; for `connect`, checks following relationship). Rate limit 20/min/UID. Writes notification to `users/{targetUid}/notifications`. Respects user `notifications` settings. Sends OneSignal push if `oneSignalId` present. Best-effort — frontend never throws on failure.

**trio-day (site.js):**
- **Static asset serving** with pretty-URL mapping (`/login` → `/login.html`, `/admin` → `/admin-activity.html`, etc.). SPA fallback adds `.html` to extension-less paths. `run_worker_first: ["/admin", "/admin/*"]` means admin routes hit the Worker first (though the Worker just proxies to assets).

### 3.4 Bypassing Workers Locally

For local development on `http://127.0.0.1:5500`:
- **Gamification Worker:** `worker-config.js` points to production URL. Local calls will fail (CORS may allow localhost but secrets won't be set). Frontend catches errors gracefully (`xp-levels.js` returns null, `notifications.js` skips on localhost unless `window.TRIO_NOTIFICATIONS_WORKER_URL` is set).
- **Media-upload Worker:** `image-upload.js` falls back to Firebase Storage if Cloudinary signing fails.
- **Notifications Worker:** `notifications.js` explicitly skips on localhost (`isLocalHost()` check) unless explicit override.
- **Site Worker:** Not used locally — `server.js` serves static files directly.

To simulate Workers locally, you would need to run `wrangler dev` for each worker and point `window.__TRIO_CONFIG__` overrides at `http://127.0.0.1:8787`.

---

## 4. CRITICAL DEVELOPER CODE BLOCKS

The following 5 code blocks are the most critical in the codebase. Understanding them is essential for safe modification.

---

### Critical Block 1 — `awardActivityXp()` in `workers/gamification.js` (lines 663-716)

**Purpose:** Server-authoritative XP award. Called by `handleCompleteTask` and `handleClaimGuestXp`. Never trusts client-sent XP amounts — amount comes from server-side task row. Idempotent per `grantKey`. Updates user profile, leaderboards, and badges.

```javascript
async function awardActivityXp({ uid, env, amount, grantKey, timeZone }) {
  const projectId = 'nkm-ind';
  const token = await getAccessToken(env);                                          // [1]

  const created = await fsCreateDoc(projectId, token, 'users/'+uid+'/xpAwards/'+grantKey, {
    uid, grantKey, amount, createdAtMs: Date.now()
  });                                                                                // [2]

  const userData = await fsGet(projectId, token, 'users/'+uid) || {};               // [3]
  if (!created) {                                                                   // [4]
    return { ok: true, xp: Number(userData.xp) || 0, ..., alreadyAwarded: true, badgesEarned: [] };
  }

  const prevXp = Number(userData.xp) || 0;                                          // [5]
  const newXp = prevXp + amount;
  const newLevel = levelFromXp(newXp);                                              // [6]
  const now = new Date();
  const weekKey = localWeekKey(now, timeZone);                                      // [7]
  const monthKey = localMonthKey(now, timeZone);

  const weeklyXp = (userData.weeklyXpKey === weekKey ? Number(userData.weeklyXp) || 0 : 0) + amount;  // [8]
  const monthlyXp = (userData.monthlyXpKey === monthKey ? Number(userData.monthlyXp) || 0 : 0) + amount;

  const allowedBadges = new Set(SYSTEM_BADGES.map(b => b.id));
  const currentBadges = Array.isArray(userData.badges) ? userData.badges.filter(id => allowedBadges.has(id)) : [];
  const earned = evaluateBadgesDelta(currentBadges, newXp, Number(userData.streakCurrent) || 0);      // [9]

  const patch = { xp: newXp, level: newLevel, weeklyXp, monthlyXp, weeklyXpKey: weekKey, monthlyXpKey: monthKey };  // [10]
  if (earned.length) patch.badges = [...currentBadges, ...earned];

  await fsPatch(projectId, token, 'users/'+uid, patch, Object.keys(patch));         // [11]

  const entry = { uid, name: userData.name || 'User', photoURL: userData.photoURL || null, level: newLevel, xp: newXp, weeklyXp, monthlyXp, streakCurrent: Number(userData.streakCurrent) || 0 };

  await Promise.all([                                                              // [12]
    upsertLeaderboard(projectId, token, 'global', entry, 'xp'),
    upsertLeaderboard(projectId, token, 'weekly_'+weekKey, entry, 'weeklyXp'),
    upsertLeaderboard(projectId, token, 'monthly_'+monthKey, entry, 'monthlyXp'),
    upsertLeaderboard(projectId, token, 'streak', entry, 'streakCurrent')
  ]);

  return { ok: true, xp: newXp, level: newLevel, weeklyXp, leveledUp: newLevel > levelFromXp(prevXp), awarded: amount, alreadyAwarded: false, badgesEarned: earned.map(...) };
}
```

**Line-by-line explanation:**

| Line(s) | What happens |
|---------|-------------|
| [1] `getAccessToken(env)` | Creates/refreshes a Google OAuth2 access token using the Firebase service account (JWT signed with RSA private key from KV `FIREBASE_KEYS`). Cached for 1 hour. |
| [2] `fsCreateDoc(.../xpAwards/{grantKey})` | Attempts to create an idempotency document. If it already exists (409 conflict), returns `false` — meaning this XP was already awarded. This prevents double awards from duplicate requests. |
| [3] `fsGet(.../users/{uid})` | Reads the current user profile from Firestore to get existing XP, level, streak, badges. |
| [4] `if (!created)` | Short-circuits if the grantKey already existed. Returns current state with `alreadyAwarded: true`. No XP is added. |
| [5-6] `prevXp`, `newXp`, `newLevel` | Computes new total XP and level (`floor(xp/100) + 1`). |
| [7] `localWeekKey/MonthKey` | Computes timezone-aware week/month keys so weekly/monthly XP resets align with the user's local calendar, not UTC. |
| [8] `weeklyXp/monthlyXp` | Accumulates XP into period buckets, resetting when the week/month key changes. |
| [9] `evaluateBadgesDelta()` | Compares current badges against new XP/streak thresholds, returns newly earned badge IDs. |
| [10] `patch` object | Builds the Firestore update payload with only changed fields (used as `updateMask.fieldPaths`). |
| [11] `fsPatch(...)` | Patches `users/{uid}` with new XP, level, weekly/monthly XP, keys, and badges. |
| [12] `Promise.all([4 × upsertLeaderboard])` | Updates 4 leaderboard documents in parallel. Best-effort — `upsertLeaderboard` swallows errors (`catch (_) {}`). |

**Return value:** `{ ok, xp, level, weeklyXp, leveledUp, awarded, alreadyAwarded, badgesEarned }`

**What happens if this breaks:** XP is not awarded, leaderboards not updated, badges not earned. `handleCompleteTask` checks `result.alreadyAwarded` — if this throws, the task completion returns 500 and the frontend shows an error. The user's task proof is not recorded.

**Modification guidance:** To change XP per level, edit `XP_PER_LEVEL` constant (line 44). To add a badge, add to `SYSTEM_BADGES` array (lines 115-122) and update `evaluateBadgesDelta`. To add a leaderboard, add another `upsertLeaderboard` call in the `Promise.all`.

---

### Critical Block 2 — `signInWithTrioUid` in `functions/index.js` (lines 64-121)

**Purpose:** The only Trio UID sign-in path. Validates format, rate-limits, resolves Trio UID → Firebase Auth user → email → Google Identity Toolkit password verification → returns custom token.

```javascript
exports.signInWithTrioUid = onCall(async (request) => {
  const trioUid = normaliseTrioUid(request.data?.trioUid);                    // [1]
  const password = String(request.data?.password || '');

  if (!/^TRIO-[A-Z0-9]{8}$/.test(trioUid) || password.length < 1) {           // [2]
    throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
  }

  await checkTrioLoginRateLimit(trioUid);                                      // [3]

  try {
    const snap = await db.collection('users')                                  // [4]
      .where('userId', '==', trioUid)
      .limit(2)
      .get();

    if (snap.docs.length !== 1) {                                              // [5]
      throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
    }

    const uid = snap.docs[0].id;                                               // [6]
    const authUser = await admin.auth().getUser(uid);                          // [7]
    const email = authUser.email;

    if (!email) {                                                              // [8]
      throw new HttpsError('unauthenticated', 'This account uses Google sign-in. Use Continue with Google.');
    }

    const response = await fetch(                                              // [9]
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email, password, returnSecureToken: true }) }
    );

    if (!response.ok) {                                                        // [10]
      throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
    }

    await clearTrioLoginRateLimit(trioUid);                                    // [11]

    const customToken = await admin.auth().createCustomToken(uid, {            // [12]
      trioLogin: true, trioUid
    });

    return { customToken };                                                    // [13]
  } catch (error) {
    if (error instanceof HttpsError) throw error;                              // [14]
    console.error('[signInWithTrioUid]', error);
    throw new HttpsError('internal', 'Unable to sign in with Trio UID right now.');
  }
});
```

**Line-by-line explanation:**

| Line(s) | What happens |
|---------|-------------|
| [1] `normaliseTrioUid()` | Trims and uppercases the input (`TRIO-ab12cd34` → `TRIO-AB12CD34`). |
| [2] Format validation | Regex `^TRIO-[A-Z0-9]{8}$` — exactly 8 alphanumeric uppercase chars after `TRIO-`. Password must be non-empty. |
| [3] `checkTrioLoginRateLimit()` | Per-Trio-UID rate limit: 5 attempts per 10-minute window, stored in `authRateLimits` Firestore collection via transaction. Throws `resource-exhausted` if exceeded. |
| [4] Firestore query | Looks up `users` collection where `userId == trioUid`. Limit 2 to detect ambiguity. |
| [5] Uniqueness check | Must be exactly 1 document. 0 = not found, 2+ = ambiguous legacy data — both rejected with generic message (no account enumeration). |
| [6-7] Get Auth user | Uses the Firestore document ID as the Firebase Auth UID. Calls `admin.auth().getUser(uid)`. |
| [8] Google-only guard | If `authUser.email` is null (Google-only account), rejects — password login doesn't apply. |
| [9] Identity Toolkit password check | Calls Google's `signInWithPassword` REST endpoint with the resolved email + user-supplied password. This is the actual password verification — Firebase Admin SDK cannot verify email/password credentials directly. |
| [10] Password validation | If the Identity Toolkit response is not OK, password is wrong → generic error. |
| [11] Clear rate limit | On successful auth, resets the attempt counter for this Trio UID. |
| [12] Create custom token | `admin.auth().createCustomToken(uid, {trioLogin: true, trioUid})` — a Firebase custom token that the client exchanges via `signInWithCustomToken`. |
| [13] Return | Returns `{ customToken }` to the client. |
| [14] Error handling | Re-throws `HttpsError` instances as-is (preserves codes like `unauthenticated`, `resource-exhausted`). Wraps unexpected errors as `internal`. |

**What happens if this breaks:** Trio UID login completely non-functional. Users with Trio UIDs cannot sign in. Email/password and Google login are unaffected (they bypass this function entirely).

**Modification guidance:** To change the rate limit, edit `LOGIN_RATE_LIMIT_MAX` (line 18) and `LOGIN_RATE_LIMIT_WINDOW_MS` (line 17). To add additional login providers, add branches in the try block before `createCustomToken`.

---

### Critical Block 3 — `saveUserProfile()` in `public/auth.js` (lines 83-139)

**Purpose:** Creates or heals the `users/{uid}` Firestore profile after sign-in. Sets display name, generates `userId`/`trioUid` on first creation only (set-once), scrubs email to `usersPrivate`. Two retry attempts for the critical write; email mirror is best-effort.

```javascript
async function saveUserProfile(user, chosenName = '') {
  const [{ collection, doc, setDoc, serverTimestamp, getDoc, getDocs, query, where, limit, deleteField }, { db }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    import('./firebase-init.js')
  ]);                                                              // [1]
  const ref = doc(db, 'users', user.uid);                          // [2]
  const snap = await getDoc(ref).catch(() => null);                // [3]
  const old = snap?.exists() ? snap.data() : {};                   // [4]
  const name = chosenName.trim() || old.name || user.displayName || user.email?.split('@')[0] || 'User';  // [5]
  const profile = {
    uid: user.uid,                                                 // [6]
    name, displayName: name,                                       // [7]
    email: deleteField(),                                          // [8] — scrub email from public doc
    photoURL: old.photoURL || user.photoURL || null,               // [9]
    bio: old.bio || '',                                            // [10]
    emailHidden: Boolean(old.emailHidden),                         // [11]
    updatedAt: serverTimestamp()                                   // [12]
  };
  if (!snap?.exists()) profile.createdAt = serverTimestamp();      // [13]
  if (!old.userId) {                                               // [14]
    let permanentUid = makeUserId(user.uid);                       // [15]
    const existing = await getDocs(query(collection(db, 'users'), where('userId', '==', permanentUid), limit(1))).catch(() => ({ docs: [] }));  // [16]
    if (existing.docs.some(d => d.id !== user.uid)) {              // [17]
      permanentUid = makeUserId(user.uid, 1);                      // [18] — collision fallback with salt=1
    }
    profile.userId = permanentUid;                                 // [19]
    profile.trioUid = permanentUid;                                // [20]
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {                  // [21]
    try {
      await setDoc(ref, profile, { merge: true });                 // [22] — CRITICAL WRITE
      lastError = null; break;
    } catch (err) { lastError = err; }
  }
  if (lastError) throw lastError;                                  // [23]
  // Best-effort email mirror:
  try {
    await setDoc(doc(db, 'usersPrivate', user.uid), { email: user.email || null, updatedAt: serverTimestamp() }, { merge: true });  // [24]
  } catch (err) { console.warn(...); }
}
```

**Line-by-line explanation:**

| Line(s) | What happens |
|---------|-------------|
| [1] Dynamic imports | Lazy-loads Firestore SDK and `firebase-init.js` (avoids loading Firestore on login page unless needed). |
| [2] Document reference | `users/{user.uid}` — keyed by Firebase Auth UID, not Trio UID. |
| [3-4] Read existing | Gets current profile if it exists. `old` used for collision detection and field preservation. |
| [5] Name resolution | Priority: chosenName (signup) → old.name → user.displayName → email prefix → 'User'. |
| [7] `displayName` | Duplicated as `name` so navbar and profile header stay in sync. |
| [8] `email: deleteField()` | Explicitly removes email from public profile — email lives only in `usersPrivate/{uid}` (owner-only). |
| [13] `createdAt` | Only set on first creation (new document). |
| [14-20] `userId` generation | Only if no existing `userId`. `makeUserId(uid)` FNV-1a hashes Firebase UID → `TRIO-XXXXXXXX`. Checks for collisions against other users' docs. If collision, retries with salt=1. Once set, never changes (protected by Firestore `canChangeUserId` rule). |
| [21-23] Critical write | `setDoc(merge: true)` with 2 retry attempts. If both fail, throws — this is what makes `/profile` dead-end if missing (comment at line 116-117). |
| [24] Email mirror | Writes email to `usersPrivate/{uid}` — best-effort, never blocks profile creation. |

**What happens if this breaks:** The `users/{uid}` document is missing or stale. `/profile` shows "User not found" (auth-guard self-heal attempts `ensureUserProfile` which has the same logic). Header shows no name/XP/streak. Sign-in still succeeds (Firebase Auth), but profile-dependent features degrade.

**Modification guidance:** To add new profile fields, add them to the `profile` object. To change the `userId` format, edit `makeUserId()` in `utils.js` — but existing users keep their old IDs (set-once). Do not add gamification fields here — they are blocked by Firestore rules (`noGamificationWrite`).

---

### Critical Block 4 — `handleCompleteTask()` in `workers/gamification.js` (lines 729-797)

**Purpose:** The core Activity completion handler. Verifies the task exists and belongs to the activity, runs AI verification on the user's proof, awards XP idempotently, logs progress to Supabase.

```javascript
async function handleCompleteTask(uid, body, env) {
  const { activityId, taskId, taskNumber, proof } = body;                    // [1]

  if (!activityId || !taskId) throw new Error('activityId and taskId required');  // [2]

  const submission = String(proof || '').trim();                             // [3]
  if (submission.length < 10) {                                              // [4]
    return { ok: false, error: 'Please write at least a short, specific reflection (10+ characters).', xpAwarded: 0 };
  }
  if (submission.length > 2000) {                                            // [5]
    return { ok: false, error: 'Reflection is too long (max 2000 characters).', xpAwarded: 0 };
  }

  const task = await supabaseAdminRequest('GET', `tasks?id=eq.${taskId}&select=${TASK_SELECT_ADMIN}`);  // [6]
  if (!task?.length) throw new Error('Task not found');
  const taskData = task[0];

  if (String(taskData.activity_id) !== String(activityId)) {                 // [7]
    throw new Error('Task does not belong to this activity');
  }

  const activity = await supabaseRequest('GET', `activities?id=eq.${activityId}&select=${ACTIVITY_SELECT}`);  // [8]
  if (!activity?.length) throw new Error('Activity not found');

  const verification = await verifyWithAI(                                   // [9]
    submission, taskData.verification_prompt, taskData.title_en, taskData.instructions_en
  );

  if (!verification.valid) {                                                 // [10]
    return { ok: false, error: verification.reason, xpAwarded: 0 };
  }

  const amount = Math.min(MAX_XP_AWARD, Math.max(0, Number(taskData.xp_reward) || 10));  // [11]
  const timeZone = resolveUserTimeZone(body?.timeZone);                      // [12]
  const taskNo = Number(taskData.task_number) || Number(taskNumber) || 0;    // [13]
  const weekKey = localWeekKey(new Date(), timeZone);                        // [14]

  const grantKey = `activity_${activityId}_task_${taskNo}_w_${weekKey}`;     // [15]

  const result = await awardActivityXp({ uid, env, amount, grantKey, timeZone });  // [16]

  if (!result.alreadyAwarded) {                                              // [17]
    await logTaskProgress({ ... });                                          // [18] — best-effort Supabase write
  }

  return { ...result, verification: verification.reason, weekKey };          // [19]
}
```

**Line-by-line explanation:**

| Line(s) | What happens |
|---------|-------------|
| [1] Destructure | Extracts `activityId`, `taskId`, `taskNumber`, `proof` from request body. |
| [2] Required fields | `activityId` and `taskId` are mandatory. |
| [3-5] Proof validation | Trims proof, rejects if <10 chars (too short) or >2000 chars (too long). Returns early with `xpAwarded: 0` — no XP awarded for invalid proof. |
| [6] Fetch task | Queries Supabase `tasks` table with service role key (to read `verification_prompt` which is hidden from public select). Selects only known columns (`TASK_SELECT_ADMIN`). |
| [7] Activity membership | Verifies the task actually belongs to the requested activity (prevents cross-activity XP farming). |
| [8] Fetch activity | Confirms activity exists (public columns only). |
| [9] AI verification | `verifyWithAI()` — spam detection + keyword overlap heuristic against `verification_prompt`, `title_en`, `instructions_en`. |
| [10] Verification gate | If AI says invalid, returns early with reason and `xpAwarded: 0`. |
| [11] XP amount | Caps at `MAX_XP_AWARD` (500), floors at 0, defaults to 10. Amount comes from server task row — never from client. |
| [12-14] Timezone + week key | Resolves user timezone (defaults to UTC), computes `weekKey` for idempotency and weekly leaderboard bucketing. |
| [15] grantKey | `activity_{id}_task_{no}_w_{weekKey}` — one award per user per task per week. |
| [16] `awardActivityXp()` | Calls Critical Block 1 — idempotent XP award, level update, badge evaluation, leaderboard upserts. |
| [17-18] Log progress | If XP was actually awarded (not already awarded), writes to Supabase `user_task_progress` table. Best-effort — failure doesn't roll back XP. |
| [19] Return | Returns result plus verification reason and weekKey to the client. |

**What happens if this breaks:** Task completion non-functional. Users cannot earn XP from Activities. The gamification Worker returns 500. Frontend shows error and does not mark task complete.

**Modification guidance:** To change the proof length limits, edit lines 4-5. To change the AI verification logic, modify `verifyWithAI()` (lines 621-659). To change XP caps, edit `MAX_XP_AWARD` (line 47).

---

### Critical Block 5 — `verifyFirebaseIdToken()` in `workers/gamification.js` (lines 337-428)

**Purpose:** Verifies a Firebase ID token's signature using Google's public x509 certificates. Used by all Workers (gamification, send-notification, media-upload have copies) to authenticate requests.

```javascript
async function verifyFirebaseIdToken(token, projectId, cacheStorage) {
  const parts = token.split(".");                                              // [1]
  if (parts.length !== 3) throw new Error("Invalid token format");

  let header, payload;                                                         // [2]
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (_) { throw new Error("Token decode failed"); }

  if (header.alg !== "RS256") throw new Error("Unsupported algorithm");        // [3]

  const now = Math.floor(Date.now() / 1000);                                   // [4]
  if (payload.exp <= now) throw new Error("Token expired");                    // [5]
  if (payload.iat > now + 60) throw new Error("Token issued in future");       // [6]
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");   // [7]
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)           // [8]
    throw new Error("Token issuer mismatch");
  if (!payload.sub) throw new Error("Missing subject");                        // [9]

  const cacheKey = "https://firebase-pubkeys.internal/v1";                     // [10]
  try {
    const cached = await cacheStorage.match(cacheKey);                         // [11]
    if (cached) {
      const keys = await cached.json();
      const publicKey = keys[header.kid];
      if (!publicKey) throw new Error("Unknown key id");
      const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const signature = b64urlDecode(parts[2]);
      const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signingInput);  // [12]
      if (!valid) throw new Error("Token signature invalid");
      return payload;                                                          // [13]
    }
  } catch (_) {}

  const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);                           // [14]
  const certMap = await res.json();

  const result = {};                                                           // [15]
  for (const [kid, pem] of Object.entries(certMap)) {
    // parse PEM → DER → extract public key → import as crypto key
    const cryptoKey = await crypto.subtle.importKey("spki", extractPublicKeyFromCert(derBytes), {...}, ["verify"]);
    result[kid] = cryptoKey;
  }

  const response = new Response(JSON.stringify(result), {...});                // [16]
  await cacheStorage.put(cacheKey, response);                                  // [17] — cache for 1 hour

  const publicKey = result[header.kid];                                        // [18]
  if (!publicKey) throw new Error("Unknown key id");

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signingInput);  // [19]
  if (!valid) throw new Error("Token signature invalid");

  return payload;                                                              // [20]
}
```

**Line-by-line explanation:**

| Line(s) | What happens |
|---------|-------------|
| [1] Split | Splits JWT into header.payload.signature (3 parts). |
| [2] Decode | Base64url-decodes header and payload, JSON-parses them. |
| [3] Algorithm check | Must be RS256 (RSASSA-PKCS1-v1_5 with SHA-256). |
| [4-9] Claims validation | `exp` not expired, `iat` not in future, `aud` matches project ID, `iss` matches Firebase securetoken issuer, `sub` present (the Firebase UID). |
| [10-13] Cache hit | Checks Cache API for cached public keys. If found, verifies signature against cached key, returns payload. |
| [14-17] Fetch + cache | Fetches Google's x509 certs, parses each cert to extract the public key, stores in Cache API with 1-hour TTL. |
| [18-19] Verify | Verifies the token signature against the key matching `header.kid`. |
| [20] Return | Returns the decoded payload (contains `sub` = Firebase UID, `email`, etc.). |

**What happens if this breaks:** All Worker endpoints return 401 Unauthorized. Gamification, notifications, and media upload signing all fail. Frontend gets 401 errors.

**Modification guidance:** Do not modify the verification logic — it must match Firebase's token format exactly. To support additional projects, change the `projectId` parameter and `FIREBASE_PUBLIC_KEYS_URL` remains the same (Google's public keys are project-agnostic).

---

## 5. LOCAL SELF-HOSTING GUIDE (STEP-BY-STEP FOR YOUR LAPTOP)

This guide walks you through running the entire Trio Day application on `http://127.0.0.1:5500` using only your laptop, without requiring any cloud deployment.

### 5.1 Prerequisites

| Tool | Version | Install Command |
|------|---------|-----------------|
| Node.js | 18+ | https://nodejs.org/ |
| npm | Bundled with Node | — |
| Git | 2.x | https://git-scm.com/ |
| Python (optional, for migration scripts) | 3.8+ | https://python.org/ |

Verify:
```powershell
node --version
npm --version
git --version
```

### 5.2 Step 1 — Clone / Open the Repository

You already have the repo at:
```
C:\Users\Nikhil Kumar\Documents\trio_day_main
```

Open a terminal in that directory:
```powershell
cd "C:\Users\Nikhil Kumar\Documents\trio_day_main"
```

### 5.3 Step 2 — Install Node Dependencies

```powershell
npm install
```

This installs `wrangler`, `@playwright/test`, and `shadcn` from `package.json`. These are dev dependencies only — the frontend runs in the browser and `server.js` uses Node built-ins.

### 5.4 Step 3 — Configure the `.env` File

The `.env` file already exists in the repo with local values. Verify it matches this:

```powershell
# Firebase / Google
FIREBASE_PROJECT_ID=nkm-ind
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Nikhil Kumar\Documents\trio_day_main\scripts\serviceAccountKey.json

# OneSignal (public app ID — REST key should NOT be in frontend)
ONESIGNAL_APP_ID=ae462d86-13fe-48d1-a577-a484f539f4cb
ONESIGNAL_REST_API_KEY=os_v2_app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # real key sirf .env / wrangler secret me

# Frontend origins allowed to call APIs
ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500

MAX_NOTIFICATION_TEXT=500
```

**Important:** `GOOGLE_APPLICATION_CREDENTIALS` points to `scripts/serviceAccountKey.json` — this file is **gitignored** and must exist locally if you want to run migration scripts or Firebase Admin operations. Generate it from Firebase Console → Project Settings → Service Accounts → Generate new private key.

### 5.5 Step 4 — Start the Local Server

```powershell
npm start
```

This runs `node server.js`. You should see:
```
Server running on http://127.0.0.1:5500
```

Open your browser to: **http://127.0.0.1:5500**

**Port configuration:** The port is read from `process.env.PORT` (default `5500`) and host from `process.env.TRIO_HOST` (default `127.0.0.1`). To change:
```powershell
$env:PORT="3000"; $env:TRIO_HOST="0.0.0.0"; npm start
# → Server running on http://0.0.0.0:3000
```

### 5.6 Step 5 — What Works vs. What Doesn't Locally

| Feature | Localhost (`server.js`) | Notes |
|---------|------------------------|-------|
| Static pages (HTML/CSS/JS) | ✅ Works | Served directly from `public/` |
| Firebase Auth (login/signup) | ✅ Works | Connects directly to `firebaseapp.com` / `googleapis.com` |
| Firestore reads/writes | ✅ Works | Connects directly to `firestore.googleapis.com` |
| Trio UID login (Functions callable) | ❌ Requires deployment | `functions/index.js` is a Firebase Function — must be deployed to Firebase to work |
| Gamification Worker (XP, tasks) | ❌ Requires deployment | `workers/gamification.js` needs secrets (service account, Supabase keys, Cloudinary keys) |
| Media-upload Worker (Cloudinary signing) | ❌ Requires deployment | Falls back to Firebase Storage automatically |
| Notifications Worker | ❌ Requires deployment | Frontend skips on localhost (`notifications.js` `isLocalHost()` check) |
| OneSignal push | ⚠️ Skipped on localhost | `onesignal.js` `isLocalHost()` returns true → no push init |
| Cloudflare Workers site routing | ❌ Not used | `server.js` handles routing instead |

### 5.7 Bypassing / Simulating Cloud Workers Locally

If you want to test gamification, notifications, or media signing locally, you have two options:

#### Option A: Run Workers with `wrangler dev` (Recommended)

1. Install wrangler globally (already in devDependencies):
   ```powershell
   npx wrangler --version
   ```

2. Create `.dev.vars` files for each worker (template in `workers/.dev.vars`):
   ```powershell
   # workers/.dev.vars
   FIREBASE_PROJECT_ID=nkm-ind
   CLOUDINARY_CLOUD_NAME=vyhglthg
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   ```

3. Set Wrangler secrets (required for gamification + notifications):
   ```powershell
   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL --config workers/wrangler.gamification.toml
   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY --config workers/wrangler.gamification.toml
   # (private key goes into KV namespace FIREBASE_KEYS)
   npx wrangler secret put SUPABASE_URL --config workers/wrangler.gamification.toml
   npx wrangler secret put SUPABASE_ANON_KEY --config workers/wrangler.gamification.toml
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/wrangler.gamification.toml
   npx wrangler secret put ADMIN_EMAILS --config workers/wrangler.gamification.toml
   ```

4. Start each worker:
   ```powershell
   npx wrangler dev --config workers/wrangler.gamification.toml    # port 8787
   npx wrangler dev --config workers/wrangler.media-upload.toml     # port 8788
   npx wrangler dev --config workers/wrangler.notifications.toml    # port 8789
   ```

5. Override frontend Worker URLs via browser console before loading:
   ```javascript
   window.__TRIO_CONFIG__ = {
     gamificationWorkerUrl: 'http://127.0.0.1:8787',
     mediaSignUrl: 'http://127.0.0.1:8788/media/sign'
   };
   window.TRIO_NOTIFICATIONS_WORKER_URL = 'http://127.0.0.1:8789';
   ```

#### Option B: Accept Degraded Local Mode (Simplest)

Run `npm start` only. The app will:
- Allow login/signup via Firebase Auth ✅
- Allow profile creation and Firestore reads ✅
- Show errors/gracefully degrade on gamification actions (XP, tasks) ❌
- Fall back to Firebase Storage for media uploads ⚠️
- Skip push notifications ❌

This is sufficient for testing UI, auth, Firestore data, and navigation.

### 5.8 Step 6 — Set Up Supabase (For Activity/Task Data)

The Activity/Task system reads from Supabase. If you want Activities to work locally:

1. Create a free Supabase project at https://supabase.com
2. Run the SQL schema from `README.md` (lines 379-440):
   ```sql
   CREATE TABLE activities (...);
   CREATE TABLE tasks (...);
   CREATE TABLE user_task_progress (...);
   CREATE TABLE user_sync_meta (...);
   ```
3. Enable Row Level Security (RLS) on all tables.
4. Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase project settings → API.
5. Add them to `.env` (for migration scripts) or to Wrangler secrets (for Worker deployment).
6. The gamification Worker reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from environment — without these, `POST /api/activity/complete-task` cannot look up tasks.

**If you don't set up Supabase:** Activity Player cannot fetch tasks. Users can still navigate to the page but will see errors. This does not affect auth, profiles, chat, or leaderboards.

### 5.9 Step 7 — Set Up Cloudinary (For Media Uploads)

Media uploads (stories, profile photos) use Cloudinary by default:

1. Create a free Cloudinary account at https://cloudinary.com
2. Get your Cloud Name, API Key, and API Secret from the dashboard.
3. Add to `workers/.dev.vars` or Wrangler secrets:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Deploy `trio-media-upload` Worker.

**Without Cloudinary:** `image-upload.js` automatically falls back to Firebase Storage (`uploads/{uid}/{fileName}`). Uploads still work but without Cloudinary optimization (`f_auto,q_auto`).

### 5.10 Step 8 — Firebase Project Configuration

The app is hardcoded to Firebase project `nkm-ind`. The public config (`apiKey`, `authDomain`, etc.) is in `public/firebase-config.js` and is already correct for this project.

For local development, you do **not** need to change `firebase-config.js` — the frontend SDK connects directly to the live Firebase project. This means:
- Real users can sign in
- Real data is written to Firestore
- No Firebase emulator needed

If you want to use the Firebase Emulator instead (to avoid writing to production):
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Init emulators: `firebase init emulators`
4. Update `firebase-config.js` to point to emulator (localhost:9090 for Auth, localhost:8080 for Firestore)
5. This is **not required** for basic local hosting.

### 5.11 Step 9 — Running the Validation Script

Before making changes, validate the repo:
```powershell
node scripts/validate-repo.mjs
```

This checks:
- All `.js` files in `public/` pass `node --check` syntax validation
- All HTML `href`/`src` references resolve to existing local files
- `firestore.indexes.json` and `firebase.json` are valid JSON

### 5.12 Step 10 — Running E2E Tests (Optional)

```powershell
npm test              # All Playwright tests
npm run test:qa       # QA audit spec only
npm run test:headed   # Tests with visible browser
```

These require browsers installed via `npx playwright install`.

### 5.13 Troubleshooting Quick Reference

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `npm start` fails | `server.js` can't bind port | Change `PORT` env var; check nothing else uses 5500 |
| Page loads blank | JS module import error | Open DevTools Console; check for 404 on `.js` imports |
| Login fails | Firebase config mismatch | Verify `firebase-config.js` matches your Firebase project |
| "User not found" on /profile | `users/{uid}` doc missing | Auth-guard self-heal runs `ensureUserProfile()` automatically |
| XP not awarded | Gamification Worker unreachable | Expected locally — Worker not running; deploy or accept degraded mode |
| Image upload fails | Cloudinary Worker unreachable | Falls back to Firebase Storage automatically |
| Push notifications silent | `isLocalHost()` check | Expected on localhost — OneSignal skipped |
| `validate-repo.mjs` fails | Broken HTML reference | Fix the `href`/`src` path or create the missing file |

### 5.14 Production Deployment (When Ready)

To deploy to production (Cloudflare Workers + Firebase Hosting):

```powershell
# Deploy static site Worker
npx wrangler deploy

# Deploy gamification Worker (with secrets set)
npx wrangler deploy --config workers/wrangler.gamification.toml

# Deploy media-upload Worker
npx wrangler deploy --config workers/wrangler.media-upload.toml

# Deploy notifications Worker
npx wrangler deploy --config workers/wrangler.notifications.toml

# Deploy Firebase Functions
cd functions && npm install && firebase deploy --only functions

# Deploy Firestore rules + indexes
firebase deploy --only firestore
```

Production URLs:
- Frontend: `https://trio-day.trioday-nikhil.workers.dev`
- Gamification API: `https://trio-gamification.trioday-nikhil.workers.dev`
- Media upload: `https://trio-media-upload.trioday-nikhil.workers.dev`
- Notifications: `https://trio-notifications.trioday-nikhil.workers.dev`

---

**End of document.** This covers every file, database, worker, critical code block, and local hosting procedure for the Trio Day application. You now have full control of the codebase.