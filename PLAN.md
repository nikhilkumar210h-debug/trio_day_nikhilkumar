# Trio Day — Product & UX Master Plan

Last updated: 2026-10-03

> **Source of truth:** This file records the current product direction, UX principles, deployment context, and decision sequence. Do not replace this plan with an unapproved full-pivot or delete-first plan.

## 0. Current status

### Verified baseline
- [x] Public app is deployed at the designated Cloudflare URL: https://trio-day.trioday-nikhil.workers.dev/
- [x] GitHub repository reviewed on `master`.
- [x] Browser QA completed with one isolated test account.
- [x] Browser QA covered 14 routes and 28 desktop/mobile captures.
- [x] Challenge pick → result → comment → reply flow worked with isolated test data.
- [x] Daily Question has no direct answer control.
- [x] Discover/Search has no usable people/follow path for a cold account.
- [x] Mobile bottom-nav “Challenge” label can truncate to `CHALLE…`.
- [x] Notifications page lacks a semantic heading for its visible title.
- [x] Reported Firebase Auth observer error was reproduced in the Browser Use run; root cause is still to be confirmed before code changes.
- [x] Text-only Story publish permission failure was reproduced in the Browser Use run.
- [x] Opposite-chat flow did not reach a usable room in the Browser Use run.
- [x] A fresh test account showed zero XP/streak after a completed Challenge; this must be reconciled with existing-account observations before assuming the gamification system is globally broken.

### Important uncertainty
The browser audit observed some production behavior that was not previously reproduced by the owner's own console/session. Treat every disputed item as **verified by the recorded browser run, but still requiring code/log-level root-cause confirmation** before changing implementation.

## 1. Deployment architecture — do not change without approval

### Current production
- **Frontend / production:** Cloudflare Workers
  - Canonical URL: https://trio-day.trioday-nikhil.workers.dev/
- **Backend/API:** Render-hosted Flask backend.
- **Auth + database:** Firebase Authentication + Firestore.
- **Media:** Cloudinary where configured.
- **Notifications:** OneSignal / existing notification Worker where configured.

### Legacy
- `https://nkm-ind.web.app/` is a **legacy Firebase Hosting URL**, not the designated current production host.

### Hard rule
Do not migrate hosting, remove Render, replace Cloudflare with Firebase Hosting, or change canonical domains merely because old Firebase Hosting files/configuration still exist.

Do not delete any existing file, feature, collection, Worker, backend component, deployment configuration, or production data without explicit approval for that specific deletion.

Do not assume a file is dead code. Propose removal first.

## 2. Current product problem

The central problem is not simply “the UI looks bad.”

The current product has:
1. A real Challenge interaction loop.
2. A weak cold-start/social-density problem.
3. Broken or incomplete handoffs from interaction to reward/social continuation.
4. A fragmented visual implementation: a shared token system exists, but pages also contain substantial page-specific CSS and inline styling.
5. Too many surfaces competing for attention on Today.
6. Missing or weak states for empty/loading/error/reward feedback.

### Product principle
Trio Day should eventually feel like:

> **“One small meaningful thing I do every day with a few people.”**

rather than:

> “A social app with many features.”

## 3. Product direction

### Keep
- Challenges.
- Daily Question.
- Solo progress.
- XP/streak once reliable.
- Profile/You, simplified.
- Share cards / WhatsApp-friendly sharing.
- Supporting private Chat when a real relationship/conversation exists.

### Cut/defer for later
- Stories as a primary product surface.
- 10-minute Opposite Chat.
- Large/emphasized leaderboards for a low-user product.
- Generic social-feed behavior.
- Mandatory photo proof.

### Do not delete yet
Challenges remain part of the product while the Study Rooms experiment is validated.

Stories and Opposite Chat removal happens only in a separately approved stage after preserving/archiving production data and checking references.

## 4. UX direction

### Today
Today should become a **daily decision screen**, not a dashboard.

Preferred hierarchy:
1. Daily Question.
2. One strong Challenge.
3. Personal progress/reward.
4. Clear Study Room CTA.

Avoid stacking many equal-weight sections and CTAs.

### Daily Question
Current problem: the question says “Answer it in your own way” but has no direct answer control.

Future intent:
- Show the question.
- Give a direct, low-friction answer action.
- Then provide a bridge into the daily study plan / room.

Preferred CTA direction:
**“Now plan today’s study with friends”**

### Discover
Do not rely on an empty people directory.

Future intent:
- Discover meaningful things to join first.
- Activity, challenges, rooms, and real signals first.
- People appear as context to real activity.

### Challenges
Keep the interaction simple:
**Question → choose → result → discuss → next**

Do not overload the card with too many simultaneous primary actions.

### Create Challenge
Reduce configuration burden.

Preferred flow:
**Question → format → choices → publish**

Advanced/optional fields should remain secondary.

### Chat
Chat should support an existing relationship or action, not be the primary cold-start mechanism.

### You / Profile
Prioritize:
- Progress.
- Streak.
- Rooms.
- Recent Challenge activity.
- Connections.

Avoid making every metric equally prominent.

## 5. Visual design system direction

The repository already has shared design tokens, but page-specific styles must stop drifting.

### Rules
- Inter for UI/body.
- Space Grotesk for display/brand.
- Two primary font weights should cover most UI.
- Small controls: ~8–10px radius.
- Cards: ~14–18px radius.
- Large hero surfaces: ~20–24px radius.
- Use only Primary / Secondary / Ghost button hierarchy.
- Keep a small number of card types: Content / Action / Progress.
- Use the existing 4px spacing scale.
- Motion should be subtle, mostly ~120–200ms.
- No animation or 3D effect unless it improves hierarchy or feedback.
- No per-page reinvention of buttons, cards, headers, or navigation.

### AI-agent rule
Never give an AI agent a vague instruction such as:
“Make every page modern/premium/cool.”

Instead, agents must:
1. Inspect the shared design system first.
2. Reuse existing tokens/components.
3. Work page-by-page.
4. Preserve the interaction hierarchy.
5. Test desktop + 390px mobile.
6. Verify loading, empty, success, error, and disabled states.
7. Report visual changes separately from functional changes.

## 6. Engagement model

The long-term return loop should move toward:

**Trigger**
→ Today’s question / reminder / room activity

**Action**
→ Answer question or complete a short study goal

**Reward**
→ Visible completion + XP/streak + room progress

**Investment**
→ Plan tomorrow’s goal / keep room alive

**Return**
→ Come back because today’s room and progress continue

### Cold-start rule
A user must get value alone.

Study Rooms are **solo-first**:
- A user can complete a goal without friends.
- Friends increase accountability/value.
- The product must not become unusable because no friend is active.

## 7. Study Streak Rooms experiment

Do not full-pivot yet.

Build Rooms as a **new feature behind a feature flag** after core bugs are stabilized.

### Initial model
- 3–6 people per room.
- One daily goal per person.
- Solo completion always works.
- Shared room streak/progress is secondary.
- The provisional shared-streak experiment can use the proposed 60% completion rule, but treat the threshold as an experiment, not a proven optimum.
- Photo proof is optional, never mandatory.
- Avoid unnecessary media/storage usage.
- Daily Question should naturally lead into planning the day.

## 8. Stage sequence

### Stage 1 — Stabilize
Reproduce and fix only verified bugs:
- Firebase Auth observer/runtime error.
- Story permission/UI mismatch.
- Opposite-chat behavior.
- XP/streak update and localhost CORS.
- Daily Question direct answer control.
- Discover/Search people path or honest empty-state behavior.
- Mobile navigation truncation.
- Notifications heading/accessibility.

**Exit condition:** test matrix passes on localhost and relevant production path.

### Stage 2 — Simplify
Only after approval:
- Remove/defer Stories from the main product surface.
- Remove/defer Opposite Chat.
- Preserve/archive production data.
- Remove code/rules only after dependency review.
- Update `DELETED.md` with approved removals.

### Stage 3 — Study Rooms
- Add Rooms tab next to Challenges.
- Feature flag.
- Solo-first.
- 3–6 members.
- Daily goal.
- Shared progress.
- Daily Question → Room CTA.

### Stage 4 — Growth loop
- Weekly progress recap.
- WhatsApp-friendly share card.
- Invite into a room.
- Keep the share action user-initiated; never spam contacts.

### Stage 5 — Stop and measure
Run a 7-day pilot with roughly 20–30 real users before expanding.

Record counts for:
- Signups.
- First goal completed within 24h.
- D1 retention.
- D7 retention.
- Rooms with 3+ active members.
- Invite conversion.
- XP/streak update success rate.

Use actual observed data to decide whether Rooms should become the main product.

## 9. Decision rules

Do not judge the product by:
- Number of screens.
- Number of features.
- Number of animations.
- Number of AI-generated CSS changes.

Judge it by:
- Can a new user understand what to do?
- Can they complete one meaningful action alone?
- Does the product clearly show the reward?
- Is there a reason to return tomorrow?
- Do users actually return without manual reminding?
- Does the social layer improve the core action instead of being a dependency?

## 10. Documentation / change control

Before any future code change:
- Read this plan and README.
- State the stage being implemented.
- List exact files to change.
- Do not delete or rewrite unrelated architecture.
- Do not deploy or merge to production without approval unless explicitly authorized.
- Update this plan after a stage is actually verified.

### Completion markers
- [x] Product direction documented.
- [x] Deployment context documented.
- [x] “No silent deletion” rule documented.
- [x] Full browser audit baseline documented.
- [ ] Stage 1 bug fixes completed.
- [ ] Visual design-system cleanup completed.
- [ ] Study Rooms feature-flag experiment completed.
- [ ] 7-day pilot completed.
- [ ] Data-based product decision made.

## 11. Current instruction to coding agents

**For now: do not change app code unless the user explicitly starts a Stage 1 implementation task.**

This plan is the current source of truth. When an older prompt conflicts with this file, use this plan and report the conflict instead of silently choosing the older instruction.
