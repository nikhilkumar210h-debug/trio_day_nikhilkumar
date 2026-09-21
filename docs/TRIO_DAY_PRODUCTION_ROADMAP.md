# TRIO DAY — Production Product Roadmap

This is the canonical roadmap for the current product pass.

## Product principle

**3 PEOPLE / 1 MOMENT** is the visual and interaction language.

The core product is interaction, not a large catalog of manually designed activities.

### Core loop

Challenge → participate → other people participate → result/interaction → interesting person → You/Chat → conversation → return to Challenges

## Phase 1 — Code / Product Foundation

### Discover
Replace the old generic Forge lanes with exactly 3 meaningful lanes:

1. **Challenges** — universal Trio mechanics: Pick, Predict, Guess, Defend, Judge, Help, etc.
2. **App-specific lane #1** — the app's actual purpose.
3. **App-specific lane #2** — deeper activity/community content.

### Product connections
- Today is driven by the current challenge and can lead to people/conversation.
- You connects people discovered through interactions.
- Chat connects to people after meaningful challenge interactions.
- Challenges remain the shared/public interaction space; private Chat remains one-to-one.
- Existing useful UI is preserved; redundant/legacy UI is consolidated rather than blindly deleted.
- Existing activities are migrated/reused where appropriate.
- Old/redundant surfaces and route leaks are removed or redirected.
- UI remains compact, modern, responsive, and interaction-first.

### Completion gate
Phase 1 is complete only when:
- Challenge is the canonical interaction surface.
- Discover has the 3 intended lanes.
- Today / You / Chat are linked to the Challenge loop.
- Legacy activity/task routes do not expose the retired product surface.
- Navigation active-state logic is correct.
- WebMCP exposes the current Challenge-first surface rather than retired activity tools.
- Existing Live Room workspace remains preserved where intentionally retained.

## Phase 2 — Browser QA

Use the browser on the actual local/preview UI, not only code inspection.

### Required QA
- Authentication / login guard
- Global navigation and active states
- Discover / 3 lanes
- Challenge open / answer / result
- Community challenge create / publish / open
- Public challenge discussion
- Today challenge flow
- You / people / connection flow
- Private Chat
- Live Room workspace where retained
- Responsive desktop/mobile layout
- Console/runtime errors
- Firebase reads/writes/listeners
- Broken buttons/links
- Loading states
- Empty states
- Error states
- Direct/legacy URL redirects
- WebMCP registration where supported

### QA loop
Browser test → reproduce → fix code → reload → retest → only then mark pass.

## Phase 3 — Backend / Production

Architecture:

Frontend HTML/CSS/JS → Flask API → Firebase + Cloudinary

Infrastructure:
- Google Cloud Run → Flask backend
- Cloudflare → DNS/CDN/edge/security
- Cloudinary → images/media
- Firebase → Auth + database/realtime

Deployment workflow:

**GitHub → implement → local/preview → browser QA → fix → production deployment → production QA**

Do not experiment directly in production.

## Current status

- Phase 1: completion pass / final cleanup.
- Phase 2: Browser QA starts after the Phase 1 completion gate is verified.
- Phase 3: not started.
