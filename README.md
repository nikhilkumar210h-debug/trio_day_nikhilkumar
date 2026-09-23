# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social app built around short public interactions, Stories, conversations and visible progress.

## Current product

### Today
- Greeting and profile shortcut.
- Story strip and Story Studio.
- Daily focus / continue surfaces.
- Challenge entry points.
- Community people/discovery surfaces.

### Stories
- Text, image, video and voice Stories.
- Lightweight editor and preview.
- Public or Friends Only visibility.
- Story reactions, replies and sharing.
- Story data uses the historical Firestore `posts` collection name, but the old Post/Feed product is retired.

### Discover
- **Challenges** — quick choices and public discussions.
- **Connect** — people and private conversations.
- **Create** — publish a community Challenge.

### Challenges
- Built-in choice Challenges.
- Community-created choice Challenges.
- Answer counts and public discussion threads.
- Persistent answers per user/Challenge.
- Challenge creation from `challenge-create.html`.
- Challenge participation records.
- Challenge completion drives gamification.

### Gamification
Gamification is intentionally **Challenge-only**.

- **XP:** 25 XP per valid Challenge award.
- **Level:** `floor(XP / 100) + 1`.
- **Current streak:** increases once per local calendar day when a Challenge is completed.
- **Best streak:** highest current streak reached.
- **Badges:** first Challenge, 3/7/30-day Challenge streaks, 500 Challenge XP and 1000 Challenge XP.
- **Weekly / monthly XP:** derived from Challenge XP awards.
- **Leaderboards:** global, weekly, monthly and streak views.
- XP, level, streak and badges are server-controlled.

The Worker uses an idempotent Challenge grant key, so the same user/Challenge cannot receive the same XP grant twice.

### Chat
- Private one-to-one conversations.
- Unread indicators.
- People search by name or Trio UID.
- Public Challenge discussions remain separate from private Chat.

### Profile / You
- Trio UID.
- Name, photo and bio.
- Followers/following.
- Level, XP, weekly/monthly XP.
- Current/best streak.
- Challenge badges and Challenge journey.

### Notifications
Current notification types cover:
- Story reactions/comments/shares.
- Connections.
- Messages.
- Challenge reminders.
- Challenge badges.

## Navigation

Canonical navigation:

**Today → Discover → Challenge → Chat → You**

The navigation is rendered by `public/ui/nav.js` and supports both clean routes and `.html` routes. The current page is marked with `aria-current="page"`, an active class/state and a visible marker.

## Authentication

- Email/password.
- Google.
- Trio UID login.
- Protected pages use `auth-guard.js`.

## Architecture

- Static HTML/CSS/ES modules under `public/`.
- Firebase Auth + Firestore.
- Cloudflare Workers for server-authoritative gamification and notification operations.
- Cloudinary for media uploads.
- Service worker for static/offline caching.

### Key gamification modules

- `public/gamification/constants.js`
- `public/gamification/xp-levels.js`
- `public/gamification/streaks.js`
- `public/gamification/badges.js`
- `public/gamification/community-tasks.js`
- `workers/gamification.js`

## Retired features removed

The following old product systems are no longer part of the application and have been removed from the source:

- Live Rooms / room collaboration.
- Forge.
- Build / Learn / Puzzle / Game activity lanes.
- Generic activity/task system.
- Old Post/Feed viewer and route.
- Legacy task reminder worker.
- Generic activity-based gamification modules.

The Story system remains supported. Its Firestore collection name `posts` is retained only as a storage compatibility detail; it is not the old Post/Feed feature.

## Data / security notes

- Protected gamification fields are not client-writable.
- Challenge XP is verified server-side against the user's Challenge answer.
- XP awards are idempotent.
- Challenge streak updates are idempotent per day.
- Community Challenge records are restricted to Challenge-shaped records.
- Firestore rules no longer expose the retired Room or generic Activity rule trees.

## Cleanup notes

Generated deployment metadata such as `.firebase/hosting.cHVibGlj.cache` is not application source.

Before a production release, run the QA suite against the final deployed revision and verify:
- Trio UID login.
- Challenge answer → XP → level → streak → badge flow.
- Story upload and privacy.
- Chat and notifications.
- Mobile and desktop navigation active state.
- Service-worker cache refresh.


## Development branch — Trio Day Core Loop V1 / Experience V2

Current working branch: `feature/trio-day-core-loop-v1`

This branch is intentionally separate from `master` and production. It contains the functional Core Loop work plus the Experience V2 visual redesign.

### Experience V2 changes

- **Today redesigned as the product home:** stronger hero hierarchy, stories, a daily challenge, live/fresh community moments, next-move cards and paths into people/chat/profile.
- **Living Today surface:** community challenges are loaded from the existing challenge system when available; the home also rotates contextual micro-prompts so the page does not feel static between sessions.
- **Challenge visual pass:** larger visual hero, richer choice cards, animated selection/result treatment, stronger community-result hierarchy and responsive layouts.
- **Brand refresh:** new Trio Day purple/yellow lightning mark and wordmark assets:
  - `public/icons/trio-day-mark.svg`
  - `public/icons/trio-day-wordmark.svg`
  - `public/icons/trio-day-logo.svg` updated to the new mark
- **Shared header branding:** the new mark is applied through `styles/header.css` so legacy glyph-based headers use the same brand system.
- **No new framework:** the redesign uses the existing HTML/CSS/ES-module architecture and preserves Firebase/Auth/Firestore contracts.
- **Accessibility:** reduced-motion handling remains enabled for the new motion layer.

### How to preview this branch locally

```bash
git fetch origin
git switch feature/trio-day-core-loop-v1
git pull origin feature/trio-day-core-loop-v1
npm install
npm start
```

Open `http://127.0.0.1:5500/` and hard-refresh with `Ctrl+Shift+R`.

Recommended review path:

**Today → answer the daily challenge → See the split → Challenge → Discover → Chat → You**

### Change log

The latest Experience V2 commits are intentionally small and reviewable. They add the visual system, the living Today layer, the new brand assets, and the README documentation without merging into `master`.

> Production deployment is intentionally unchanged until this branch has been reviewed and tested.

## Experience V3 — actual product redesign

The latest iteration is a structural product pass, not only a visual polish layer.

### Today
- Treats Today as a living home instead of a static dashboard.
- Strong visual moment/hero area.
- Daily choice remains the primary interaction.
- Fresh community moments and next actions create reasons to return.
- People, chat and journey paths are visible as part of the same loop.

### Challenge
- Reframed around **Choose → Compare → Discuss**.
- The question and choices are the primary visual object.
- Choice cards have larger touch targets and stronger selected/hover states.
- Community results and discussion are visually connected to the choice.
- Desktop uses a richer two-column card rhythm; mobile collapses to one column.

### Discover
- Removed the visually disconnected dark hero treatment from the light experience.
- Uses the Trio Day light visual language: lavender, white, violet and warm accent.
- Discovery lanes are presented as interactive visual cards.

### Chat
- Adds a Trio-native “shared moment” entry point so Chat connects back to Challenges.
- Conversation rows receive stronger hierarchy, avatars and interaction states.
- The goal is not to copy a generic messenger; it is to turn shared choices into conversations.

### Brand
- New purple/yellow lightning mark and wordmark assets are available under `public/icons/`.
- Shared header branding uses the same mark.

### Safety of the rollout
All V3 changes remain on `feature/trio-day-core-loop-v1`. No merge or production deployment is part of this pass.

### Challenge V3.1 — Moment Builder

Challenges are no longer presented as question + answer like an exam.

Creators can choose a **moment shape**:
- Quick Pick — fast choice
- Would You — two-sided decision
- Hot Take — agree/disagree energy
- Scenario — imagine a situation

Creators can also add an optional **little twist** such as a constraint or playful rule. The preview shows the actual social moment before publishing.

On the challenge surface:
- No-right-answer framing
- A/B/C/D visual choice chips
- Format badge
- Optional twist card
- Stronger choice interactions
- Community result as a visual split
- Public discussion attached to the moment
- Users can delete their own discussion comments through the message menu

The Firestore rules already permit an authenticated user to delete only their own challenge discussion message; no rule relaxation was required for this feature.

## Audit — 23 September 2026

A local browser pass was run against the current branch across the main product routes: Today, Discover, Challenge, Create Challenge, Chat, You, Search, Help, Privacy and Login. Authentication, Firestore rules, Firebase initialization, the UID-login callable and the local server were also reviewed.

### Bugs found and fixed in this pass

1. **Challenge answer controls had unnecessary copy.**
   - Removed the persistent "Your choice is saved..." message.
   - Choice buttons no longer show response counts inside the answer label; counts belong in the result visualization.
   - Choices remain editable.

2. **Trio UID login could appear stuck.**
   - The previous flow tried the Render UID endpoint first without a request timeout.
   - A slow/cold/unavailable Render service could hold the login state in "Signing in…" before the Firebase fallback was reached.
   - Firebase Callable `signInWithTrioUid` is now the primary path with an 8-second timeout.
   - Render remains a timed fallback.
   - Successful Firebase authentication no longer gets treated as a failed login merely because the secondary Firestore profile-sync write fails.
   - Redirect targets are restricted to the current origin.

3. **Legacy headers were still showing glyphs instead of the current logo.**
   - The shared header now normalizes legacy brand marks to `public/icons/trio-day-logo.svg`.

4. **Help Center was describing retired Forge / Room / Puzzle / Build / Learn / Game systems.**
   - Rewritten around the current Challenge → Compare → Discuss product loop.

5. **Privacy page contained retired product concepts.**
   - Updated to describe the current Account, Challenges, Stories, Private Chat and Progress model.

6. **Earlier Today/Create regressions were also verified during this audit.**
   - Today live moments render instead of remaining blank skeletons.
   - Create Challenge has a single "Your question" field.
   - Moment Builder formats and optional twists remain available.

### Login architecture

Trio UID authentication now follows:

Trio UID + password → Firebase Callable → Firebase custom token → Firebase Auth

If the Callable is unavailable, the Render endpoint is attempted as a bounded fallback. Email/password and Google authentication remain separate Firebase Auth paths.

A successful Firebase Auth session is no longer blocked by non-critical profile synchronization.

### Audit limitation

The branch contains a large pre-existing history and many legacy/support files. GitHub currently reports the branch as substantially ahead of master. The audit focused on the current application routes and the source files that control authentication, navigation, challenges, creation, data rules and the current product surfaces. Legacy snapshots are not treated as active product routes.

No merge to master and no production deployment was performed during this audit.

### Additional source audit fixes
- Fixed malformed closing markup in `voice-status.html` (`</body>`).
- Fixed the Admin denial fallback link from retired `tasks.html` to the current `challenge.html` route.
- Normalized legacy header glyphs to the canonical logo through `ui/header.js` instead of maintaining per-page logo variants.

### Theme & Help UI pass — 23 September 2026

- Added a persistent Help Center entry to the shared header and Account menu.
- Help Center title/branding now uses Trio Day instead of the retired Forge identity.
- Help Center cards, hero and flow surfaces now have explicit light/dark treatments rather than relying on dark-only translucent backgrounds.
- Story Studio now follows the active theme: light mode uses light surfaces and dark mode uses dark surfaces, while the editor/canvas remains visually distinct.
- Discover, Challenge and Today hero surfaces now have theme-specific variants so light mode does not contain a large dark hero and dark mode does not contain an accidental light hero.


### Challenge feed + voter visibility pass — 23 September 2026

- Community Challenges remain strictly newest-first after active-window filtering.
- The feed now reads a wider recent window before filtering, so expired/future records do not consume the visible limit.
- Challenge-list cache keys include the requested maximum size, preventing a smaller cached result from being reused for a larger request.
- Each Challenge can now show **Who chose what**: compact profile chips with a small avatar and name grouped under the selected option.
- Voter profiles link to the existing profile page, but the UI intentionally avoids large profile cards so the Challenge surface stays clean.
- Extra voters are collapsed behind **+ N more** per option and expand only within that option group.
- No Firestore rule relaxation was needed: Challenge answers are already readable by signed-in users, while writes remain restricted to the answering user.
- No merge to master and no production deployment were performed.


### Progressive loading UX standard — 23 September 2026

The UI now follows a progressive-loading rule instead of treating every collection as “load everything”: show the useful first slice, then reveal more on demand or as the user approaches the end.

| Surface | Initial load | More data | Reason |
| --- | ---: | --- | --- |
| Challenge feed | Daily picks + 12 active community prompts | Future pagination/auto-load | Questions are the main discovery surface; keep first paint compact. |
| Challenge voters | 2 small avatars per option | Small modal, 12 profiles/batch + load-more fallback | Profile details are secondary and should never create a large card. |
| Challenge discussion | 30 recent messages | Future cursor pagination | Discussion needs context, but the whole history should not be loaded. |
| Private chat | 50 messages | Future cursor pagination | Keep the live conversation responsive; older history is on demand. |
| Chat inbox | 20 conversations | Future incremental loading | Only recent active conversations are useful in the first viewport. |
| Notifications | 50 live notifications | Future pagination | Recent alerts are the primary use case; avoid unbounded realtime reads. |
| Profile connections | 500-count bound for counts | Connection list should be paged when opened | Counts do not require rendering hundreds of profiles. |

Limits are intentionally **surface-specific**, not one global number. The next pagination pass should use Firestore cursors (`startAfter`) and IntersectionObserver where scrolling is the natural interaction; explicit **View more / Load more** remains the fallback for accessibility and users who prefer deliberate loading.


### Challenge interaction + chat cleanup pass — 23 September 2026

- Removed the standalone **Who chose what** panel. Voter avatars now live directly inside the existing community-result rows, beside each option/count.
- Only the first two voter avatars are shown as a compact overlapping peek; clicking an avatar or +N opens the small people sheet for that option.
- The people sheet loads profile details in batches of 12 and auto-loads another batch near the bottom instead of rendering the full voter list at once.
- Community result + voter peek are now visible after challenge data hydrates, so a user does not need to answer first to see the community activity.
- Choosing an answer no longer automatically opens/focuses the discussion. **Join the discussion** is an explicit action.
- Discussion UI is intentionally smaller/denser and the Next Challenge transition now uses a short exit animation before navigation.
- Removed visible Trio UID/ID from Chat inbox rows, private-chat header, and Chat search copy. Internal UID fields remain in data/URLs where required for routing and Firestore identity.


### Challenge interaction correction — 23 September 2026

- Removed the separate **Who chose what** panel; voter avatars now live inside each existing community-result row.
- Each option shows a maximum of two small overlapping avatars plus a compact +N control; clicking opens the small scrollable voter window.
- Challenge navigation no longer auto-opens discussion. **Join the discussion** is an explicit user action.
- Private chat no longer displays the permanent Trio UID in conversation rows/header, and new messages no longer write the display-only UID field.
- Challenge discussion chat was tightened for a smaller, cleaner footprint.
- Next Challenge now uses a smoother outgoing transition and button sweep/pulse while navigating.
