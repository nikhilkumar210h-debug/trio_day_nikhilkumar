# Trio Day

**Trio Day — Do Something Worth Coming Back To**

Trio Day is an action-first social web app built around Stories, interactive Challenges, private conversations, people discovery, and Challenge-based progress.

## Current product

### Today
- Home surface with greeting, Stories, daily focus, Challenges, and people/community moments.
- Story creation and viewing.
- Entry points into the Challenge → Compare → Discuss loop.

### Discover / Challenges
- Interactive community Challenges.
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
