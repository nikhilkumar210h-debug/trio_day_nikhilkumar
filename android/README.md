# Trio Day for Android

Trio Day helps you build steady habits through small, meaningful daily
activities. This folder contains the native Kotlin and Jetpack Compose
Android app, which connects to the existing Trio Day services — the same
Firebase project, Supabase activity/task data, Cloudflare Workers and
Cloudinary media used by the web app.

## Design

The app is a full native port of the web experience:

- Same design tokens as the web app (tokens.css): deep-obsidian dark theme
  `#090A0F` / violet→indigo `#8B5CF6 → #6366F1` gradients, light theme
  `#F8F7FF`, glass surfaces, 18–24dp radii, shimmer skeletons.
- Signature tricolor strip, `trio_day` brand mark and emoji-first icons.
- Premium touches: gradient buttons, XP progress track, gold/silver/bronze
  podium, badge grid, chat bubbles with seen ticks, unread dots.

## Features

- **Today**: guest trial (3 free starter activities), growth-path
  onboarding cards, category dashboard with Switch Goal and show-all
  fallback, EN/HI language toggle, shimmer loading and retry states.
- **Activity player**: task progress bar, type/min-time/XP chips,
  AI-verified reflection proof, skip (0 XP) and an XP completion screen.
- **Leaderboard**: Weekly / Global XP / Monthly / Streak tabs, top-3
  podium and full ranking with the current user highlighted.
- **Chat**: inbox with unread badges, 1:1 threads with bubbles,
  delete-own, seen ticks and live polling.
- **You**: avatar with Cloudinary photo upload (via the media Worker),
  Trio UID copy, level + XP progress bar, global rank, streaks, shield
  activation (Worker-verified), the 6 badge grid, profile editing,
  connections, notifications, settings, help and sign-out.
- **Discover**: member directory with search and a streak leaderboard
  tab; member sheets with follow/message actions.
- **Admin** (admin accounts only): activity CRUD, task CRUD, published /
  guest-allowed toggles and cover-image uploads — through the same
  gamification Worker endpoints the web admin page uses.
- **Settings**: dark/light theme, EN/HI language, daily goal switcher,
  sideload update checker.

Everything XP-, streak-, shield- and badge-related stays server
authoritative: completions are verified and awarded by the
`trio-gamification` Worker exactly like on the web.

## Build a debug APK

Requirements: Windows, JDK 17, and Android SDK 34 (or a compatible
installed SDK).

From the repository root, run:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
.\android\gradlew.bat -p android assembleDebug
```

The APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This build is debug-signed and intended for development or direct testing.
Sharing updates with existing installs requires signing each APK with the
same private release key. Do not commit that key to the repository.

## In-app updates

The update checker reads the latest GitHub Release for this repository.
To publish an installable update, increment `versionCode` and
`versionName` in `app/build.gradle.kts`, build and sign the APK with the
matching release key, then attach it to a semantic-version release as
`trio-day.apk`. Building an APK locally does **not** publish it.

## Backend connection

The app talks directly to the production services — no web-app code is
modified and no new Firebase Android app is registered:

| Service | Used for | Endpoint style |
|---|---|---|
| Firebase Auth (nkm-ind) | email/password, Trio ID sign-in, reset, secure refresh-token storage (Android Keystore) | Identity Toolkit REST |
| Cloud Firestore (nkm-ind) | profiles, follows, private chats, notifications | Firestore REST |
| Supabase | published activities + tasks (and all activities for admins) | PostgREST |
| trio-gamification Worker | task complete/skip, guest claim, shields, admin activity/task CRUD, cover signing | REST + Bearer ID token |
| trio-media-upload Worker | signed profile-photo uploads | REST + Bearer ID token |
| trio-notifications Worker | message/interaction notifications | REST + Bearer ID token |
| Cloudinary | profile photos and activity covers (`f_auto,q_auto` optimized) | signed multipart |
| GitHub Releases | sideload update checks | REST |
