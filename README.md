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
