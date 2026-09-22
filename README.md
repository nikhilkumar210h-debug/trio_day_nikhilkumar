# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social activity platform built around short, meaningful interactions rather than a traditional feed. The current product centers on **Today, Discover, Challenge, Chat, You**, community-created activities, Stories, gamification, and optional live rooms.

## Current product

### Today
- Personalized greeting and profile shortcut.
- Daily visual summary and the current public moment.
- Story strip with Story Studio.
- Today's Challenge / focus interaction.
- Continue / active challenge sections when data exists.
- People/community discovery surfaces.
- Challenge entry points connect Today to the public Challenge loop.

### Stories
- Create a Story from the Today page.
- Caption support.
- Image/video selection.
- Preview and lightweight editor.
- Filters and intensity.
- Text overlay with font, size and color controls.
- Sticker picker.
- Public or Friends Only privacy choice.
- Story history is separate from the retired post/feed concept.

### Discover
Discover is the community hub for finding the next social moment.
- Challenges: quick choices, debates and shared prompts.
- Connect: find people and open conversations.
- Create: publish a community question/activity.
- Community challenge preview and discussion entry points.

### Challenges
The canonical public interaction surface.
- Built-in choice challenges.
- Community-created choice challenges.
- Answer counts and response split.
- One public discussion thread per challenge.
- Next Challenge navigation.
- Answer persistence per user/challenge.
- Challenge activity can award XP and update the daily streak.
- Community challenge completion is handled through the gamification Worker with idempotent grant keys.

### Forge / Activities
The activity system supports four main activity lanes:
- Build
- Learn
- Challenge
- Puzzle

Activity data is normalized through the activity catalog and shared activity UI.
- Activity cards.
- Activity detail pages.
- Timed / interactive workspaces.
- Build, quiz, challenge and game mechanics.
- Community-created activities.
- Completion evidence where required.
- Optional live-room entry for compatible activities.

### Community activity creation
Logged-in users can create lightweight community activities/questions.
- Activity type and difficulty.
- Goal, instructions and duration.
- Expiry/cycle configuration.
- XP reward.
- Interaction payload.
- Creator attribution.
- Community membership/join state.
- Likes, comments and creator following where supported.
- Moderation controls for admins.

### Gamification
XP and protected gamification writes are server-side.
- XP total.
- Levels.
- Weekly XP.
- Monthly XP.
- Current streak.
- Best streak.
- Badges.
- Global/friends/weekly/monthly/streak leaderboard surfaces.
- Achievement UI and profile journey.
- Idempotent XP grants prevent the same grant key from being awarded repeatedly.

Current level formula:
- XP_PER_LEVEL = 100
- level = floor(xp / 100) + 1

The profile currently displays:
- Level and progress to next level.
- XP total.
- Weekly XP.
- Monthly XP.
- Current streak.
- Best streak.
- Badges.
- Recent Challenge journey.

### Chat
Private one-to-one messaging.
- Conversation list.
- Search by name or Trio UID.
- Recent message preview.
- Unread-state tracking.
- Private chat remains separate from public Challenge discussions.

### Live Rooms
Live Rooms are available as an activity collaboration surface rather than a primary navigation destination.
- Create/join an activity room.
- Capacity control.
- Host/member roles.
- Invite friends by connection or Trio UID.
- Room chat.
- Shared activity workspace.
- Leave/end room controls.
- Microphone/voice controls.
- WebRTC peer voice path.
- Moveable/resizable room chat panel with session persistence.
- Active-room session protection prevents accidental navigation away from a live room.

rooms.html is currently a compatibility entry that redirects to the canonical Challenge surface; actual room sessions use room.html?id=....

### Profile / You
- Permanent Trio UID.
- Profile name/photo/bio.
- Followers/following.
- Gamification summary.
- Badges.
- Challenge journey.
- Connections.
- Leaderboard entry.

### Authentication
Supported authentication paths include:
- Email/password.
- Google sign-in.
- Permanent Trio UID + password flow.

The browser keeps the public Trio UID separate from the account email. Protected pages use auth-guard.js.

### Notifications
- In-app notification menu.
- Read/unread state.
- Notification navigation.
- OneSignal integration for push notifications where configured.
- Room, connection, message and gamification-related notification paths are supported.

## Navigation

Canonical primary navigation:

**Today → Discover → Challenge → Chat → You**

The navigation is rendered by public/ui/nav.js.

The current-page state now uses:
- aria-current="page" for accessibility.
- body[data-current-nav].
- .active / data-active state.
- A visible active marker.
- Responsive mobile bottom navigation.
- Responsive desktop left rail.
- Retry/recovery rendering so the nav is less vulnerable to late page/script timing.

## Architecture

### Frontend
- Static HTML/CSS/ES modules under public/.
- Firebase Auth and Firestore.
- Cloudflare Worker endpoints for protected gamification/notification operations.
- Cloudinary for supported media uploads.
- Service worker for offline/static caching.
- Shared UI modules under public/ui/.
- Shared service/cache helpers under public/services/.

### Gamification
Key modules:
- public/gamification/xp-levels.js
- public/gamification/streaks.js
- public/gamification/constants.js
- public/gamification/progress.js
- public/gamification/community-tasks.js
- public/gamification/badges.js
- workers/gamification.js

### Authentication
Key modules:
- public/auth.js
- public/auth-guard.js
- public/auth-ui.js
- public/firebase-init.js
- public/firebase-config.js
- backend/routes/auth.py
- functions/index.js

## Security / data model notes

- Protected gamification fields are intended to be server-controlled.
- Firestore rules protect XP, level, streak and leaderboard fields from direct client mutation.
- Community XP grants use bounded reward values and idempotent grant keys.
- Trio UID lookup rejects ambiguous UID mappings.
- User email is stored in the private user document instead of the public profile document.
- Room membership and invitations are scoped to the authenticated user/host.
- User-generated discussion text is escaped before rendering in the main Challenge UI.

## Current audit findings

### Verified through the connected browser
- Today loads for the signed-in user.
- Profile loads and shows Trio UID, level, XP, weekly/monthly XP, streaks and badges.
- Challenge page loads with public choice interactions and discussion entry points.
- Discover loads with Challenge / Connect / Create lanes.
- Chat loads with private conversations.
- The public API health endpoint responds successfully.
- The Trio UID API route exists and rejects unsupported GET requests correctly.

### Needs deeper production verification
1. Trio UID login
   - The browser currently uses the Render API endpoint for Trio UID login.
   - The endpoint is alive, but a real credentialed POST could not be executed through the available browser connector during this audit.
   - The backend intentionally returns a generic 500 message when Firebase/Admin/Identity Toolkit operations fail. This is the current area to test with a real Trio UID account.

2. Live Room
   - rooms.html intentionally redirects to Challenge because Live Rooms were moved out of the Discover navigation surface.
   - A real room.html?id=... session still needs a full join/chat/mic/end-room browser pass for production sign-off.

3. XP / streak / challenge
   - Code inspection shows idempotent Worker-side XP grants and date-aware streak updates.
   - A full end-to-end write test should still be run with a real account for answer → XP → level → streak → profile refresh.

## Cleanup / legacy audit

### Confirmed unused or duplicate candidates
- README.txt is a legacy documentation file; this repository now uses README.md.
- legacy/activity/ contains an older copy of activity code that duplicates current public/ activity modules. It is not part of the active page imports and should remain archived or be removed in a dedicated cleanup pass.
- .firebase/hosting.cHVibGlj.cache is generated deployment metadata, not application source.
- Old post/view-post files are still referenced by legacy notification/search paths, so they cannot be safely deleted merely because the main Today surface no longer exposes posts. They should be removed as one coordinated migration if the old post data/links are no longer required.

### Deliberately retained compatibility code
Some legacy references are compatibility shims, not dead code. Examples include:
- theme-key migration.
- old profile/user lookup fallback.
- header normalization.
- old shared-link base-path handling.

These should not be deleted without checking the migration purpose.

## Production checklist

Before calling the release production-ready:
- [ ] Real Trio UID login succeeds with a known test account.
- [ ] Email login succeeds.
- [ ] Google login succeeds.
- [ ] Challenge answer persists after refresh.
- [ ] Challenge XP grant is exactly once.
- [ ] Daily streak is exactly once per day.
- [ ] Level transition updates correctly.
- [ ] Weekly/monthly XP rollovers are correct.
- [ ] Badge evaluation and profile refresh work after XP changes.
- [ ] Story upload succeeds for image and video within configured limits.
- [ ] Story privacy is enforced.
- [ ] Community activity creation/completion works.
- [ ] Live room create/join/chat/mic/leave/end flow works.
- [ ] Mobile navigation visibly identifies the current page.
- [ ] Desktop rail visibly identifies the current page.
- [ ] No unexpected old Post UI appears.
- [ ] Service-worker cache is refreshed after release.
- [ ] Legacy/backup files are removed only after reference analysis.
- [ ] Firebase/Worker/Render deployment versions are aligned with this Git revision.

## Repository layout

- public/ — web application.
- public/gamification/ — XP, streaks, badges, community activity logic.
- public/ui/ — shared navigation/header/toast/search UI.
- public/services/ — shared backend/cache/notification helpers.
- workers/ — Cloudflare Worker endpoints and background jobs.
- functions/ — Firebase Cloud Functions.
- backend/ — Flask API.
- docs/ — product/roadmap documentation.
- qa-audit.spec.js, nav-audit.spec.js — automated QA coverage.
- firebase.json, firestore.rules, firestore.indexes.json — Firebase configuration.

## Product principle

Trio Day is **action-first, not feed-first**: open the app, choose a meaningful moment, interact with other people, and come back to a visible record of progress.
