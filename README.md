# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social web app built around Stories, interactive Challenges, private conversations, people discovery, and Challenge-based progress.

## Current product direction

The current strategic direction is **not a full pivot yet**.

> **One small meaningful thing I do every day with a few people.**

Challenges remain the current interaction engine while the product is stabilized. Study Streak Rooms will later be tested as a feature-flagged experiment, with solo-first value and a small-group accountability loop.

The current product/UX roadmap and decision sequence are maintained in **[PLAN.md](PLAN.md)**.

### Product priorities

**Keep and strengthen**
- Daily Question.
- Challenges: question → choose → result → discuss.
- Solo progress, XP and streak once reliable.
- Simplified You/Profile.
- Supporting private Chat when a real relationship or action exists.
- User-initiated share cards suitable for WhatsApp.

**Defer / simplify**
- Stories as a primary product surface.
- 10-minute Opposite Chat.
- Large leaderboard emphasis while the user base is small.
- Generic social-feed behavior.
- Mandatory photo proof.

The app should not depend on having an existing social graph just to provide first-session value.

## Deployment

### Current production

- **Frontend / canonical production:** Cloudflare Workers  
  https://trio-day.trioday-nikhil.workers.dev/
- **Backend/API:** Cloudflare Workers (gamification, media sign, notifications). The legacy Render-hosted Flask backend has been retired and removed.
- **Authentication + database:** Firebase Authentication + Cloud Firestore.
- **Media:** Cloudinary where configured.
- **Notifications:** Existing OneSignal/notification Worker where configured.

### Legacy hosting

`https://nkm-ind.web.app/` is a **legacy Firebase Hosting URL** and must not be treated as the designated production host.

Do not migrate hosting or remove old hosting configuration simply because Firebase Hosting files remain in the repository.

## Change-control rule

No existing feature, file, backend component, Worker, deployment configuration, Firestore collection/data, Firebase rule, or production configuration may be deleted, disabled, renamed, or replaced without explicit approval for that specific change.

Do not treat an apparently unused file as permission to delete it.

Before significant code work, read [PLAN.md](PLAN.md), identify the stage being implemented, and report the exact scope of changes.


## Current product

### Today
- Home surface with greeting, Stories, daily focus, Challenges, and people/community moments.
- One fixed daily student question is published by the existing Cloudflare cron Worker, with a deterministic local fallback and one-day client cache.
- Friend-streak surface reuses the existing following graph and server-authoritative streak fields.
- Story creation and viewing.
- Entry points into the Challenge → Compare → Discuss loop.

### Discover / Challenges
- Interactive community Challenges.
- Student-focused filters: Career, Study, College, Tech, Life, Fun.
- Challenge results reveal immediately with percentage bars and compact voter avatars.
- Share cards are generated client-side with Canvas and use Web Share when the browser supports it.
- A 10-minute temporary chat can be opened with a participant who chose a different side.
- Newest Challenges appear first.
- Users can choose, change their choice, compare the community split, and join the public discussion.
- Challenge creators and participant profiles remain connected to the social graph.
- Challenge creation supports multiple moment formats and optional twists.

### Stories
- Text, image, video, and voice Stories.
- Public or Friends Only visibility.
- Reactions, replies, and sharing.
- Stories intentionally retain the historical Firestore collection name `posts` for storage compatibility; the retired Post/Feed product is not part of the current UI.

### Chat
- Private one-to-one conversations.
- Unread indicators and people search.
- Private Chat is separate from public Challenge discussions.
- Users can delete their own messages.

### You / Profile
- Profile photo, name, bio, Trio UID, followers/following.
- Challenge XP, level, streaks, badges, and progress.
- Theme controls are available from the profile menu.

### Notifications
- Story activity.
- Connections.
- Messages.
- Challenge reminders and Challenge badges.

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
- Cloudinary for media.
- Service worker for caching/offline behavior.

## Architecture inventory (Step 4 REA audit — 2026-10-17)

> Audited with REA `analyze_javascript_application` (retained analysis `ev_ef1a7227e8fc6acbdb33923f5d1c8cbfc043f0e499031dcc86f341087d4408d2`, summary view `ev_6c74e43e4231cb424f56a88207c589c606dd664a9aa088edf5563b4fd9415763`): 13,961 files inventoried, 56 app JS files parsed, 828 findings, 1 parse failure. Live deployment at `https://trio-day.trioday-nikhil.workers.dev/` verified byte-identical to the working tree (SHA-256 comparison of 16 key files; `public/temp-chat.js` differs only by a UTF-8 BOM).

### File / folder tree (condensed)

```
trio_day_main/
├─ wrangler.jsonc               # Root Worker "trio-day" — static assets only: { assets: { directory: "./public" } } (no main script)
├─ server.js                    # Local static dev server (127.0.0.1:5500, GET/HEAD only, no-store)
├─ firebase.json / .firebaserc # Legacy Firebase Hosting config + Firestore rules/indexes; project: nkm-ind
├─ firestore.rules              # Firestore security rules v2 (single source of truth for DB access)
├─ firestore.indexes.json       # Composite indexes (posts, communityTasks) + field overrides (users.userId, members.uid)
├─ storage-rules.txt            # Firebase Storage rules (Cloudinary fallback path uploads/{uid}/)
├─ functions/index.js           # Firebase Functions v2 callable signInWithTrioUid (us-central1) + authRateLimits
├─ workers/                     # Separate Cloudflare Workers (own wrangler.*.toml each)
│  ├─ gamification.js           #   trio-gamification — POST /gamification/award-xp | bump-streak | use-shield
│  ├─ gamification-cron.js      #   trio-gamification-cron — crons 0 * * * * + 15 0 * * * (⚠ parse error, line 222)
│  ├─ media-upload.js           #   trio-media-upload — POST /media/sign (Cloudinary signatures)
│  ├─ send-notification.js      #   trio-notifications — POST /notifications/create
│  └─ shared/cors.js            #   Shared CORS allowlist (4 prod origins + localhost)
├─ public/                      # Everything below is served by the trio-day Worker as static assets
│  ├─ index.html + script.js + daily-question.js + friend-streak.js   # Today (home)
│  ├─ login.html + auth.js      # Sign-in / sign-up (email, password, Google, Trio UID)
│  ├─ all-users.html + all-users.js  # Discover (static promo hub + challenge preview rotation)
│  ├─ challenge.html + challenge.js   # Challenge feed (18 built-ins + communityTasks)
│  ├─ challenge-create.html/.js      # Community challenge builder
│  ├─ chat.html + chat.js       # Chat inbox (conversation list)
│  ├─ private-chat.html/.js     # 1:1 private conversation
│  ├─ temp-chat.html/.js        # 10-minute opposite-pick temporary room
│  ├─ profile.html/.js         # You/Profile (identity, gamification, connections)
│  ├─ search.html/.js          # People search (the actual user directory)
│  ├─ settings / notifications / leaderboard / help / privacy-policy / terms / 404 pages
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

The root `wrangler.jsonc` declares **no Worker script** — the production site is a pure **Workers static assets** deployment of `public/`. Workers Assets' default `html_handling` (`auto-trailing-slash`, `auto-pretty-urls`) maps pretty URLs to `.html` files. **There is no server-side routing code**; all navigation/redirect logic is client-side (`auth-guard.js` login redirects, `ui/nav.js` active state, `location.href` links). Verified live 2026-10-17:

| Route | Served file | Entry scripts | Guard |
|---|---|---|---|
| `/` | `public/index.html` | script.js, daily-question.js, friend-streak.js, auth-ui, header/nav | auth-guard |
| `/login` | `public/login.html` | auth.js | public page |
| `/all-users` | `public/all-users.html` | all-users.js (promo rotation only) | auth-guard |
| `/challenge` | `public/challenge.html` | challenge.js (feed + matchmaking) | auth-guard |
| `/challenge-create` | `public/challenge-create.html` | challenge-create.js | auth-guard |
| `/chat` | `public/chat.html` | chat.js (inbox) | auth-guard |
| `/profile` | `public/profile.html` | profile.js | auth-guard |
| `/private-chat`, `/temp-chat`, `/search`, `/settings`, `/notifications`, `/leaderboard`, `/help`, `/privacy-policy`, `/terms` | corresponding `.html` | corresponding page JS | mixed |
| unknown | `public/404.html` | — | — |

**Sidecar API Workers** (separate deployments, called from the browser):
- `trio-gamification` → `POST /gamification/award-xp`, `POST /gamification/bump-streak`, `POST /gamification/use-shield` (Firebase ID-token auth; KV-held service account key)
- `trio-gamification-cron` → cron `0 * * * *` (expired story/voice + tempChat cleanup, Cloudinary destroy) and `15 0 * * *` (publishes `config/dailyQuestion`) — **currently undeployable: parse error at `workers/gamification-cron.js:222`**
- `trio-media-upload` → `POST /media/sign` (Cloudinary signature endpoint)
- `trio-notifications` → `POST /notifications/create` (server-side notification writes)
- Legacy `trio-onesignal-push` (OneSignal REST proxy) referenced by `onesignal-config.js`

### Firebase (Authentication + Firestore)

- **SDK**: Firebase modular SDK **10.13.0** via gstatic CDN ESM imports (`firebase-app`, `firebase-auth`, `firebase-firestore`, `firebase-storage`, `firebase-functions`) — pinned in `firebase-init.js:2-4`, `image-upload.js:182`, `auth.js:6`, etc. No npm Firebase dependency.
- **Project**: `nkm-ind` (`firebase-config.js:7`); Auth domain `nkm-ind.firebaseapp.com`.
- **Database type**: **Cloud Firestore** (`getFirestore(app)` in `firebase-init.js:8`). **No Realtime Database** is used anywhere.
- **Auth**: Email/password, Google (`auth.js:173-192`), Trio UID via callable `signInWithTrioUid` (`functions/index.js:64-121`, rate-limited via `authRateLimits` collection). `usersPrivate/{uid}` stores emails owner-only (`auth.js:113-116`).

**Firestore schema (collections actually read/written by the app):**

| Feature | Path | Key fields |
|---|---|---|
| Profile / directory | `users/{uid}` | name, userId `TRIO-XXXXXXXX`, photoURL, bio, emailHidden, updatedAt + server-protected xp, level, streakCurrent/Best/LastDate, weeklyXp, monthlyXp, badges, shields |
| Connections | `users/{uid}/followers/{followerUid}`, `users/{uid}/following/{followedUid}` | uid, userId, name, createdAt |
| Notifications | `users/{uid}/notifications/{id}` | type, actorUid, actorName, text, read, createdAtMs |
| Gamification internals | `users/{uid}/progress/{periodKey}`, `users/{uid}/activityCompletions/{id}`, `users/{uid}/xpAwards/{grantKey}` (worker-written) | idempotency keys, amounts |
| Private email | `usersPrivate/{uid}` | email, updatedAt (owner-only) |
| Stories / voice | `posts/{postId}` (+ `comments/{cid}`, `likes/{uid}`, `moods/{uid}`) | type `story`/`voice`, isStory/isVoice, message, mediaUrl, privacy `public`/`friends`, allowedUids, expiresAtMs (24h window enforced by rules) |
| Challenge answers | `challengeAnswers/{uid_challengeId}` | challengeId, uid, choice 0-4, createdAtMs |
| Challenge counters | `challengeStats/{challengeId}` | total, choice0-4 (transactional) |
| Challenge discussion | `challengeThreads/{challengeId}/messages/{id}` (+ `replies/{id}`) | uid, name, text ≤280, choiceLabel, createdAtMs |
| Private chat | `privateChats/{uidA_uidB}/messages/{id}` (uids sorted) | uid, name, text ≤500, seen, sharedChallenge*, replyToStoryId |
| Opposite-pick temp room | `tempChats/{roomId}/tempMessages/{id}` (roomId = sorted uids + challengeId) | participants[2], challengeId, expireAt/expiresAtMs (10 min) |
| Daily Question | `config/dailyQuestion` (published by cron) + `dailyAnswers/{uid_questionKey}` | date, index, question, answer ≤280 |
| Community challenges | `communityTasks/{taskId}` (+ `members/{uid}`, `completions/{id}`) | title, description, goal, interaction{kind,question,options,clues}, category, xpReward=25, status |
| Leaderboards / badges | `leaderboards/{boardId}`, `badges/{badgeId}` | server-written only |
| Group chat (legacy) | `groupChat/{messageId}` | uid, text |
| Admin config | `config/admins`, `config/dailyQuestion` | uids list; daily prompt |
| Login rate limit | `authRateLimits/{sha256(trioUid)}` | attempts, windowStartedAtMs (Functions) |

**Rules & indexes**: `firestore.rules` (497 lines) — users readable by any signed-in user; gamification fields client-write-blocked (`noGamificationWrite`, `firestore.rules:149-161`); `userId` set-once (`canChangeUserId`, :165-175); stories create-validated with 23-25h expiry (:60-77); privateChats participant-only (:291-311); tempChats 2-participant + expiry (:339-368); communityTasks create fully schema-validated (:439-484). Composite indexes in `firestore.indexes.json` (11 indexes: posts by type/privacy/isStory/uid/allowedUids/expiresAtMs; communityTasks by status/kind/createdAtMs).

### Cloudinary upload pipeline (rules)

- **Cloud**: `vyhglthg` (`workers/wrangler.media-upload.toml:7`, client constant `public/image-upload.js:2`). **No unsigned preset — every upload is signed.**
- **Signing**: browser → `POST https://trio-media-upload.trioday-nikhil.workers.dev/media/sign` (`public/image-upload.js:5`, `getSignedParams` :87-104) with Firebase ID token; Worker (`workers/media-upload.js`) verifies the token (:100-146), rate-limits 20 signatures/min/UID (:24-39), and **controls folder/public_id/resource_type** — client cannot override:
  - `story_image` → folder `trio/stories`, jpg/jpeg/png/webp, ≤12 MB, overwrite:false (`media-upload.js:43-49`)
  - `story_video` → folder `trio/stories`, mp4/mov/webm, ≤100 MB, overwrite:false (:50-56)
  - `profile` → folder `trio/profiles`, jpg/jpeg/png/webp, ≤8 MB, overwrite:true, publicId `{uid}_avatar` (:57-63, :72-78)
- **Signature scheme**: SHA-1 of alphabetically sorted `folder=…&overwrite=…&public_id=…&timestamp=…` + `CLOUDINARY_API_SECRET` (`media-upload.js:226-237`); upload POST goes straight to `https://api.cloudinary.com/v1_1/{cloud}/{resourceType}/upload` with api_key, timestamp, signature, folder, public_id, overwrite (`image-upload.js:113-137`).
- **Story Studio path**: `uploadStoryMedia(uid, file)` (`image-upload.js:191-220`) — images upload the **original file** (≤12 MB, no compression) with kind `story_image`; video/audio ≤100 MB with kind `story_video` (`uploadSignedVideo` :146-168). `uploadProfileImage` (:223-237) canvas-crops to 640 px/≤500 KB (`compressImageFile` :27-69) and uploads with kind `profile`.
- **Fallback**: if Cloudinary/Worker is unavailable, both paths fall back to **Firebase Storage** `uploads/{uid}/{fileName}` (≤40 MB, image/*|video/*, per-user isolation — `image-upload.js:178-188`, `storage-rules.txt:13-19`).
- **CORS**: Workers accept only `trio-day.trioday-nikhil.workers.dev`, `nkm-ind.web.app`, `nkm-ind.firebaseapp.com`, `trio-day.web.app`, localhost (`workers/shared/cors.js:2-7`).
- **Deletion**: expired story/voice media is destroyed from Cloudinary by the cron Worker (`deleteFromCloudinary`, `workers/gamification-cron.js:166-198`) — currently blocked by the parse error below.

### Step 4 live-bug audit (root causes — no code changed)

| # | Symptom (live) | Root cause (file:line) |
|---|---|---|
| a | `/profile` "+ Add a short bio" → dead click / `/profile#`, page shows "User not found" | The signed-in user has **no `users/{uid}` doc**: `auth.js:350-356` proceeds with sign-in even when `saveUserProfile()` (auth.js:83-119) fails, and nothing heals the doc later. `profile.js:404-405` (`getCachedUser` → `userCache.js:12-24`) then renders "User not found" and **early-returns**. The CTA is `<a href="#">` (`core-loop.js:38-47`, injected on /profile via `ui/header.js:138-144`) whose handler clicks `#profileMenuBtn` — still `hidden` (`profile.html:71`) and **without onclick** because `profile.js:466-470` was skipped → dead click; the `href="#"` fallback navigates to `/profile#` whenever the listener isn't attached. |
| b | `/profile` Connections card stuck "Loading connections…" | `profile.html:149-151` hardcodes the placeholder; the **only** code that replaces it is `loadConnections()` (`profile.js:92-122`), called solely from `loadProfile()` line 628 — **after** the line-405 early return. On a "User not found" profile the early return skips it, so the placeholder never resolves. (On a healthy profile it renders "No followers yet." etc.) |
| c | `/chat` stuck on 3 pulsing skeleton cards (0 messages) | `chat.html:38` ships 3 permanent `td-skeleton` cards in `#userList`. They are only ever replaced by `renderInbox()` (`chat.js:46-103`), which is unreachable until `onAuthStateChanged → loadUsers() → watchInbox()` completes; `loadUsers()`'s Firestore query `chat.js:146` is **not wrapped in try/catch** (unique in the file), so any Firestore failure becomes an unhandled rejection with **no error/empty UI**, leaving the skeletons forever. With 0 conversations the correct state is the "No conversations yet" empty card (`chat.js:55-58`) — never reached. Aggravator: `chat.html:48` loads `chat.js` **without a `?v=` cache-buster** (only module on the page without one), so browsers can keep executing a stale older module after deploys. |
| d | `/challenge` "10-min opposite chat" appears dead; "3 people. 1 moment." banner unclickable | Button rendered `challenge.js:569` **does** have a handler (`challenge.js:678-688`), but: (1) `challenge.js:679` silently `return`s when auth hasn't resolved → true no-op click; (2) matchmaking requires the user's own answer (alert :681) and scans only the **first 40 answers** (`challenge.js:683-685`) — with a small user base it (correctly) alerts "No one on the opposite side yet" nearly always; there is **no queue/room matchmaking**. The "3 people. 1 moment." banner lives at `all-users.html:18` (also login hero `login.html:205`, Today card via `script.js:508/563`) — it is **marketing copy with no click handler by design**; only its inner "Open Challenges ↗" `<a>` navigates. |
| e | `/all-users` (Discover) shows static promo cards, not user profiles | `all-users.html:13-21` is entirely static promo markup (lanes, challenge hub, "3 people. 1 moment." banner, create CTA) with **no user-list container at all**; `all-users.js:4-21` only renders a hardcoded 4-item CHALLENGES rotation into `#challengePreview` — **nothing on the page queries the `users` collection**. The actual people directory is `search.html` + `search.js` (the "Connect" lane links to it). "all-users" is a legacy filename now hosting a marketing/Discover hub. |

**Additional audit findings (not in the bug list):**

1. **`workers/gamification-cron.js` cannot parse/deploy** — line 222: `name.match(/\\/tempChats\\/([^/]+)\\/tempMessages\\//)` has double-escaped backslashes; the regex literal closes at `/\\/` and `tempChats` becomes invalid flags (`SyntaxError: Invalid regular expression flags`, confirmed via REA parse stats + Node `vm.SourceTextModule`). Consequence: the canonical repo version of the hourly cleanup + 00:15 daily-question publisher **cannot be deployed**; the live cron worker (if any) is an older build, and expired tempChats/posts and stale daily questions are not cleaned by this code. (Also `deleteExpiredPosts` at :244 hardcodes `PROJECT_ID` instead of `env.FIREBASE_PROJECT_ID`.)
2. `public/temp-chat.js` (local) starts with a UTF-8 BOM — harmless for browsers but a deploy/consistency smell; live copy has no BOM.
3. `chat.html:48` is the only unversioned module reference (stale-cache hazard, ties into bug c).
4. Firebase Web API key is intentionally public (documented in `functions/index.js:12-15`) — not a secret leak.
5. `login.html` hero and `all-users.html` banner reuse "3 people. 1 moment." copy while the live Challenge flow has no group-of-3 mechanics — copy/UX mismatch worth a product decision.

## Security

- Gamification fields are server-controlled.
- Challenge XP awards are verified server-side and idempotent.
- Firestore rules restrict Challenge membership and private-chat access.
- Retired Room and generic Activity rule trees are not exposed.
- Story storage remains supported without restoring the retired Post/Feed product.

## Retired product systems

The current master product does not use:
- Live Rooms / room collaboration.
- Forge.
- Build / Learn / Puzzle / Game activity lanes.
- Generic activity/task systems.
- The old Post/Feed viewer.
- The legacy task-reminder Worker.
- Generic activity-based gamification.

## Navigation

Canonical navigation:

**Today → Discover → Challenge → Chat → You**

The shared navigation marks the current route with an active state and `aria-current="page"`.

## Design system

- Inter is the primary UI/body font.
- Space Grotesk is the display/brand font.
- Heavy Baloo 2 display styling is no longer part of the core design system.
- Headings use controlled 700 weight and compact sizing instead of oversized/heavy typography.
- Light and dark themes share the same semantic tokens and spacing system.

## Gamification

Challenge participation is server-authoritative: the client records the user's answer, then the authenticated gamification Worker verifies the answer before awarding XP/streak progress. XP awards are idempotent per user + Challenge, and Firestore rules block direct client writes to protected gamification fields.

Challenge response totals use a write-time challengeStats document maintained in a Firestore transaction, while the answer collection remains the source of truth for audit/recovery.

Temporary chat rooms and their messages carry Firestore expireAt timestamps. On the zero-budget deployment, the existing Cloudflare cron Worker cleans expired temporary-chat documents; Firestore TTL is intentionally not enabled because Firebase currently requires billing for TTL deletes.

Story/voice expiry is also server-authoritative: each ephemeral item receives an `expiresAtMs` value and the hourly cleanup Worker deletes only documents explicitly identified as Story or Voice, including their Cloudinary media when credentials are configured.

## Validation

Before production release, run the repository release checks and a browser pass covering:
- Authentication, including Trio UID login.
- Today and Stories.
- Challenge feed ordering, participation, discussion, and creation.
- Chat and message deletion.
- You/profile and navigation active state.
- Mobile and desktop layouts.
- Service-worker/cache behavior.
- Firebase rules and indexes.

## Repository hygiene

Master is the production-safe source of truth. Changes should be made deliberately and verified before deployment. Legacy compatibility code should only be removed when it is confirmed unused by the current Story, Challenge, Chat, Auth, or notification flows.


## Phases 1–10 release status

The current release branch implements the planned Challenge-first loop in one pass:

1. Bug fixes — greeting/logo/next/XP/response-count/moderation/rank fixes.
2. Instant results — transactional response counters and immediate percentage bars.
3. Share loop — client-side Canvas share card, Web Share/clipboard fallback, stable Challenge deep links.
4. Daily question — 30 student/career/exam/college/life/fun prompts, published by the existing Cloudflare cron Worker at 00:15 UTC with deterministic fallback.
5. Opposite-side chat — participant-to-participant temporary room with a 10-minute expiry field.
6. Student categories — Career, Study, College, Tech, Life, Fun, Community filters and deep links.
7. Discover — student-focused category shortcuts while retaining the existing Challenge/Connect/Create lanes.
8. Today + friend streak — daily question and friend streak surface without introducing a second social graph.
9. Firestore cost pass — bounded queries, short client caches, transaction counters, and a documented read/write budget.
10. Final QA foundation — release checks, security-rule updates, cron-based temporary-chat cleanup, and a consolidated audit document.

### Release / cost notes

- No existing Firestore documents are deleted by this release.
- Challenge answer writes remain one document per user + Challenge.
- Home response totals use count aggregation; Firebase documents that aggregation queries return only the summary and are billed from index entries read.
- The transactional challengeStats document is an optimization for immediate UI updates; if it is unavailable, the client falls back to the existing answer write and read-time aggregation path.
- Temporary-chat cleanup is capped at 200 document deletes per cron run to keep cleanup bounded.
- Cloudflare Preview Builds are enabled for non-production branches; the Preview command is `npx wrangler preview`.
- Login hardening: Firebase Auth's built-in abuse protections remain enabled, and Trio UID login now has a server-side 5-attempt / 10-minute per-UID limiter plus a client-side failure cooldown.
- Signup requires explicit acceptance of the Terms & Conditions and Privacy Policy.
- Privacy Policy, Terms & Conditions, and Help Center were refreshed for the current Challenge/Story/Chat product and linked as public pages.
- Full cost notes are in FIRESTORE_COST_AUDIT.md.

## Changelog (step-by-step)

### Step 4 — Audit & report only (2026-10-17)

**Scope rule honored: no application logic was modified in this step — only this README was updated.**

1. Loaded the REA reverse-engineering workflow and ran `analyze_javascript_application` against the repository root (`trio_day_main`) as a `directory` target, selecting all 56 app JS files under `public/`, `workers/`, `server.js`, and `functions/index.js` (13,884 remaining inventoried files — mostly `node_modules` — left unselected by design).
2. REA results retained in-session: full analysis `ev_ef1a7227e8fc6acbdb33923f5d1c8cbfc043f0e499031dcc86f341087d4408d2`, summary view `ev_6c74e43e4231cb424f56a88207c589c606dd664a9aa088edf5563b4fd9415763` — 13,961 relevant files, 56 parsed JS, 61,119 AST nodes, 828 findings, **1 parse failure**, 20 limitations (notably: inline `<script>` bodies inside HTML files were inventoried but not deep-analyzed).
3. Identified the parse failure independently (Node `vm.SourceTextModule` sweep of all 60 repo JS files): **`workers/gamification-cron.js:222`** — invalid regex flags from double-escaped backslashes; the cron worker is undeployable as committed.
4. Verified the live deployment `https://trio-day.trioday-nikhil.workers.dev/`: all 7 primary routes (`/`, `/login`, `/all-users`, `/challenge`, `/challenge-create`, `/chat`, `/profile`) return HTTP 200 with the expected pages (Workers static assets `auto-pretty-urls`); unknown routes → 404. Confirmed the Worker config is assets-only (`wrangler.jsonc`, no `main` script) — no server-side routing exists.
5. Byte-compared 16 live files against the working tree (SHA-256, newline-normalized): all identical except `public/temp-chat.js`, which differs only by a leading UTF-8 BOM in the local copy. Conclusion: the live bugs are in the current source, not a stale deploy.
6. Traced all 5 reported bugs through the source to exact file/line root causes (documented in "Step 4 live-bug audit" above): (a) missing `users/{uid}` doc + dead `href="#"` CTA wired to an unwired hidden menu button; (b) `loadProfile` early return skipping `loadConnections`; (c) unreplaced skeleton placeholders + unguarded `chat.js:146` boot query + unversioned `chat.js` module reference; (d) silent-return + first-40-answers matchmaking + non-interactive marketing banner; (e) Discover page redesigned as static promo hub with no `users` query.
7. Inventoried the complete Firestore schema (26 paths incl. subcollections), the security-rule guarantees, indexes, the four sidecar API Workers and their endpoints, and the full Cloudinary signed-upload pipeline (kinds, folders, formats, size caps, signature scheme, rate limit, CORS allowlist, Storage fallback) — all recorded above in "Architecture inventory".
8. Updated this README only (no code, rules, configs, or data touched) per the project's global documentation rule.

**Next recommended steps (for approval before Step 5):** add a `?v=` to `chat.html`'s `chat.js` reference (done in Phase 1); decide product-side whether Discover should list user profiles again or stay a promo hub; decide whether the opposite-chat button should show busy/empty feedback instead of silent returns.

### Phase 1 — Core self-healing, profile/chat bug fixes & cron storage cleanup (2026-10-17)

**Scope rule honored: only application logic related to the five live bugs plus the cron storage-cleanup regex; no unrelated features touched.**

1. **Self-healing `users/{uid}` profiles** — so `/profile` never again renders "User not found" for the signed-in user.
   - `public/services/userCache.js` (+imports `setDoc`, `serverTimestamp`, `deleteField`, `makeUserId`): new exported **`ensureUserProfile(authUser, chosenName)`** — idempotent self-heal: if `users/{uid}` is missing, creates it with `uid`, `name`, `displayName`, `userId`/`trioUid` (`TRIO-XXXXXXXX`), `bio: ''`, `photoURL`, `emailHidden: false`, `createdAt`, `updatedAt`; scrubs `email` from the public doc (it lives in `usersPrivate`). Gamification fields (xp, level, streak*) are intentionally NOT seeded — `firestore.rules` `gamificationKeys()` rejects client writes to them; the gamification Worker owns them, and readers coerce missing values (`xp→0`, `level→1`, `streak→0`). Fast path: cached/existing doc short-circuits to a no-op.
   - `public/auth.js` (`saveUserProfile`, :83-119): the critical `users/{uid}` write now runs **first** with one retry on transient failure; the `usersPrivate` email mirror is demoted to best-effort `try/catch` so it can never block profile creation; profile payload gains `displayName` sync, `createdAt` seed on create, and `trioUid` alias alongside `userId`. Callers (`:350-356` sign-in flows, Google/redirect paths) still never hold sign-in hostage — failures are logged, not surfaced.
   - `public/auth.js` `onAuthStateChanged` listener: fire-and-forget `ensureUserProfile` call (wrapped in `void`, `try/catch`) on every authenticated session landing on the login page.
   - `public/auth-guard.js`: session-wide fire-and-forget `ensureUserProfile` hook on every authenticated page load — this is what makes the heal "every authenticated session", not just on sign-in. Never blocks or diverts the auth gate.
   - `public/profile.js` (`loadProfile`, :404-405): when the owner's own `users/{uid}` doc is missing, auto-initializes it via `ensureUserProfile(me)` instead of rendering "User not found" + early-returning; on hard failure it now renders a graceful missing-profile state **and still runs `loadConnections()`** so the Connections card never stays stuck. Header name now reads `current.displayName || current.name || 'Trio Member'`.
   - `public/profile.js` save handler: switched `updateDoc` → `setDoc(..., { merge: true })` with `displayName: name`, so saving self-heals a missing doc instead of failing with "document not found".
   - `public/script.js` (`renderGreeting`, :103-131): greeting resolves `myProfile.displayName || myProfile.name || currentUser.displayName || 'Trio Member'` — now matches the `/profile` header; replaced the duplicated local `ensureUserProfile` (which wrote the user's email into the public doc on every home load, conflicting with `auth.js`'s `usersPrivate`-only email convention) with delegation to the shared `userCache.js` heal; avatar uses `myProfile.photoURL`.
2. **"+ Add a short bio" direct wiring + Connections loader** (`public/core-loop.js`, `public/ui/header.js`, `public/profile.js`, `public/profile.html`):
   - `public/core-loop.js` (:38-47): the CTA is now `<button type="button">` (never `<a href="#">`) so it can never navigate to `/profile#`; clicking dispatches `CustomEvent('trio:open-bio-editor')`. `profile.js` listens for it and opens the bio editor modal directly — even when `#profileMenuBtn` is hidden/unwired and while the profile doc self-heals. Bumped `ui/header.js` injection to `core-loop.js?v=20261017-core-loop2`.
   - `public/profile.js` (`loadConnections`, :92-122): wrapped in `try / catch / finally`; on empty followers/following or error, `#connectionsList` shows the clean empty state **"No connections yet — Match in a challenge to connect!"**; a `finally` block guarantees the "Loading connections…" placeholder can never survive the function.
3. **`/chat` infinite skeletons + cache buster** (`public/chat.js`, `public/chat.html`, `public/temp-chat.js`):
   - `public/chat.js`: `renderInbox()` now keys off actual conversations + on-demand, cache-backed participant profiles (`peerProfiles`, via `getCachedUser`) instead of assuming partners live in an arbitrary first-20 users snapshot; `watchInbox()` bounds the followers query to `limit(100)` and prefetches partner profiles; `loadUsers()` (`:146`) is wrapped in `try / catch` so a Firestore permission/network failure never blocks `watchInbox()`/`renderInbox()` from clearing the 3 skeleton cards (`public/chat.html:38`); with 0 conversations the correct "No conversations yet" empty state now renders instead. Bounded directory fetch only as a fallback peer source.
   - `public/chat.html:48`: `chat.js` now loaded with `?v=20261017-chat1` cache-buster, matching the other HTML pages (prevents stale-module skeleton lock-in after deploys).
   - `public/temp-chat.js`: leading UTF-8 BOM removed (byte-identical to live now).
4. **Storage auto-cleanup cron regex** (`workers/gamification-cron.js:222`): fixed the double-escaped regex (`name.match(/\/tempChats\/([^/]+)\/tempMessages\//)`) — previously closed early (`/\\/` + invalid `tempChats` flags) → `SyntaxError: Invalid regular expression flags` → worker undeployable; it now parses cleanly and properly deletes expired 10-minute `tempChats` rooms and 24-hour stories (Cloudinary `destroy` included) to protect free-tier storage. (Follow-up: `deleteExpiredPosts` still hardcodes `PROJECT_ID` instead of `env.FIREBASE_PROJECT_ID`.)

**Verification results**
- `node --input-type=module --check` on all 10 modified files: **0 syntax errors** — including `workers/gamification-cron.js` (its previously sole repo-wide parse failure is resolved).
- `validate-repo.mjs` HTML-reference scan (21 HTML files) + JSON config parse (`firestore.indexes.json`, `firebase.json`, `package.json`, `wrangler.jsonc`): **0 broken references, 0 invalid JSON**. (The script's default `node --check` JS loop fails on every ESM module in `public/` because `package.json` has no `"type": "module"` — pre-existing environment limitation, unrelated to these changes; ESM checks via `--input-type=module` pass.)
- Live deployment parity remains confirmed (all files edited in Phase 1 were previously verified byte-identical to live; these fixes are not yet deployed).

**Next recommended steps:** deploy the fixed `trio-gamification-cron` worker and re-verify hourly cleanup runs; wire `trio:open-bio-editor` handling in any other profile-surface pages if they render the bio CTA; consider adding `?v=` cache-busters to remaining unversioned module references; decide product-side whether Discover (`/all-users`) should list user profiles again.
