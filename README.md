# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social web app built around Stories, interactive Challenges, private conversations, people discovery, and Challenge-based progress.

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
- Full cost notes are in FIRESTORE_COST_AUDIT.md.
