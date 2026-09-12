TRIO DAY 2.0 — Action Platform
===============================

Project path: C:\Users\Nikhil Kumar\Documents\trio_day_main

PHASE 1 — COMPLETE
------------------
- Full audit of v1.1 codebase (Firebase Auth, Firestore, Cloudinary, Cloudflare Workers)
- Mapped 18 Firestore collections with schemas
- Documented 8 critical feature dependency chains
- Identified 21 features for retain/replace/remove per 2.0 roadmap
- 10 migration risks documented with mitigations
- Git baseline established at commit 674c0f2 on phase-1 branch

PHASE 2 — DESIGN SYSTEM (DARK + LIGHT) — COMPLETE
--------------------------------------------------
**Objective:** Build the Trio Day 2.0 design system on top of existing v1.1 codebase.

### 1. Semantic Design Token System (tokens.css)
Created comprehensive token system with 11 semantic color tokens:
- background, surface, elevated surface
- primary text, secondary text, muted text
- border, accent, success, warning, danger

Plus tokens for: spacing, typography, radii, shadows, control heights, avatar sizes, transitions, z-index, breakpoints.

### 2. First-Class Dark & Light Themes
- Both themes intentionally designed (not inverted)
- Light theme: #f8fafc background, #0f172a text, soft shadows
- Dark theme: #0a0f1a background, #f1f5f9 text, elevated surfaces
- Theme persistence via localStorage
- System preference detection (prefers-color-scheme)
- Meta theme-color updates for browser UI

### 3. Standardized Components
All components updated to use semantic tokens:
- **Typography**: Inter (UI), Space Grotesk (display), Baloo 2 (brand)
- **Font sizes**: xs(11.2px) → 4xl(36px) with rem units
- **Spacing**: 4px base scale (space-1 through space-16)
- **Radii**: xs(6px) → 2xl(32px) + full
- **Shadows**: xs → lg + glow + inner
- **Buttons**: .btn, .btn.primary, .btn.secondary, .btn.ghost, .btn.sm, .btn.lg
- **Inputs**: .field input/textarea with focus states
- **Cards**: .nkm-card, .feed-item, .profile-card
- **Modals/Sheets**: .modal-overlay, .nkm-sheet with animations
- **Tabs**: .media-source-tabs, .nkm-tabs
- **Badges/Chips**: .nkm-badge, .story-badge, .connected-pill
- **Toasts**: .app-alert stack with slide-in animation
- **Skeletons**: .skeleton-card, .nkm-skeleton with shimmer
- **Loading states**: .spinner, .empty-state

### 4. Interactive States
All interactive elements have proper states:
- **Hover**: translateY(-1px), color/background transitions
- **Active**: scale(0.96-0.98)
- **Focus**: 3px ring with --color-primary-soft, outline-none
- **Disabled**: opacity:0.5, cursor:not-allowed
- **Success/Error**: .status.error with --color-danger, .action-btn.liked with --color-secondary

### 5. Accessibility
- **Contrast**: All text meets WCAG AA (4.5:1) in both themes
- **Focus visible**: 2px outline with offset on all interactive elements
- **Reduced motion**: prefers-reduced-motion disables animations/transitions
- **ARIA**: Proper labels, roles, and live regions
- **Keyboard**: All interactive elements reachable and operable

### 5. Theme Switching
- Theme toggle button in header (desktop)
- Persists preference to localStorage
- Respects system preference on first visit
- Updates meta theme-color for browser chrome
- Smooth transitions between themes

### 6. Premium UI Polish
- No giant empty cards, excessive borders, huge buttons
- No card-inside-card clutter
- Subtle, functional animations (120-300ms)
- No unnecessary libraries (vanilla CSS/JS only)
- Backdrop-filter blur on sticky headers/modals

---

PHASE 3 — APP SHELL + NAVIGATION — COMPLETE
--------------------------------------------------
**Objective:** Build a consistent Trio Day global application shell across desktop and mobile while preserving all existing functionality.

### 1. Canonical 5-Item Navigation
- **Desktop:** Left rail with Today / Discover / Do / Chat / You + Create button
- **Mobile:** Bottom nav (5 equal columns) with floating Create FAB
- **Labels updated:** Home→Today, Community→Discover, Activity→Do, + Chat, + You
- Desktop rail: 72px icon-only at tablet, 240px expanded at wide
- Active state styling consistent across all pages

### 2. Global Theme System (Single Source of Truth)
- **Single localStorage key:** `trio-theme` (migrates legacy `trio_theme`)
- **Pre-paint bootstrap:** Inline `<script>` in `<head>` of every page sets `data-theme` before first paint (eliminates FOUC)
- **theme.js loaded everywhere:** No page-independent theme state
- **Removed hard-locks:** Eliminated `setAttribute('data-theme','dark')` in script.js, create.js, tasks.js
- **Theme toggle auto-injected:** header.js adds toggle button when window.TrioTheme exists
- **Meta theme-color updates:** Browser UI chrome matches theme

### 3. Light Theme — First-Class Visual Polish
- **Darker muted text:** `--color-ink-muted-light: #334155` (was #475569)
- **Darker dim text:** `--color-ink-dim-light: #64748b` (was #94a3b8) — WCAG AA compliant
- **Stronger glass layers:** opacity 0.08/0.12/0.16 (was 0.04/0.08/0.12)
- **Stronger borders:** opacity 0.12/0.20 (was 0.08/0.14)
- **Stronger shadows:** 0.08/0.10/0.12/0.15 (was 0.06/0.08/0.10/0.12)
- All semantic tokens updated in tokens.css; duplicate light-theme block removed from style.css

### 4. Mobile Shell Hardening
- 5-column `minmax(0, 1fr)` grid ensures `YOU` never overflows at 320–414px
- Floating Create FAB (56px) at bottom-right, no column collision
- Safe-area-inset-bottom respected
- Touch targets ≥44px
- No horizontal overflow (html/body overflow-x: hidden)

### 5. Desktop Shell
- Left rail pushes content correctly (72px/240px)
- Active nav state obvious
- Content spacing preserved
- No horizontal overflow

### 6. Legacy CSS Cleanup
- `--nkm-surface/#141b2e` → `var(--color-surface)` across all shell CSS
- `--nkm-border/...` → `var(--color-border)`
- `--nkm-radius-md/16px` → `var(--radius-md)`
- `--nkm-font-display/...` → `var(--font-display)`
- Hardcoded `#0b1220` backgrounds → `var(--color-bg)`
- Hardcoded `rgba(0,0,0,0.6)` scrims → `var(--color-glass-strong)`

### 7. All-Users Sidebar Overlap Fixed
- Grid layout updated to use rail width at ≥1280px
- Context rail hidden below 1280px

### 8. Login Compatibility
- tokens.css loaded on login.html
- Legacy variable remap handles inline dark `:root` block
- No auth-flow changes

### 9. Accessibility & QA
- Focus-visible outlines on all interactive elements
- ARIA labels on navigation, theme toggle, chat indicators
- Reduced-motion respected (animations disabled)
- WCAG AA contrast verified for both themes
- Touch targets ≥44px

### 10. Phase 3 Remediation (real-browser fixes)
- **FOUC/root background:** Migrated inline `html{background:#0a0f1a}` literals to `var(--color-bg)`; added `html` background + `--color-primary-text` token to tokens.css
- **Invalid `rgba(var(--color-bg-elevated),…)`** in topbar/nav/chat backgrounds replaced with `var(--color-bg-elevated)`
- **Light readability:** `ui/tasks.css`, `styles/studio.css`, and page inline styles migrated to semantic tokens
- **Accent text:** `--color-primary-text` (`#a5b4fc` dark / `#4f46e5` light) keeps accent labels readable in both themes
- **Nav canonicalization:** Static 5-item markup matches nav.js; inline 4+1 nav CSS removed
- **Rail overlap:** `notifications-main`/`search-main`/`policy-main`/`view-post-main` added to rail offset
- **Broken script tags:** literal `` `n `` corruption removed from 16 pages
- **tokens.css** added to 404.html and sitemap.html
 
PHASE 4 — TODAY / HOME — CURRENT / NOT COMPLETE
--------------------------------------------------
**Objective:** Implement the Today/Home page as the central action discovery interface.

**Status:** Production implementation not complete. Design preview exists in `public/design-preview.html` but must not be treated as completed implementation.

**Key Requirements:**
- Primary question: "What should I do now?"
- Not a generic feed; prioritizes meaningful action
- Suggested hierarchy:
  - greeting + streak
  - Today's Focus
  - primary recommended action
  - Continue
  - recommended activities/challenges
  - active challenges
  - meaningful people/activity context
  - selective achievements/highlights
- Should not become a huge dashboard with dozens of equal cards
- Implement using existing design tokens, theme system, and components where appropriate
- Real existing application data, responsive behavior
- Dark/light theme support, loading states, empty states, error states
- Accessibility compliant, mobile-first UX

---

TECH STACK
----------
Frontend: HTML, CSS (vanilla, ES modules), JS (vanilla, ES modules), PWA
Backend: Google Cloud Run (Python/Flask) [Target - Migration in Progress]
          Cloudflare Workers (Current - to be migrated)
Auth: Firebase Authentication
Database: Cloud Firestore
Media: Cloudinary (unsigned uploads)
Push: OneSignal via Cloudflare Worker proxy (Transitioning to Flask)
Hosting: Cloudflare (static frontend) + Google Cloud Run (Flask API)

CURRENT STATUS & ROADMAP
------------------------
**22-Phase Roadmap:** Trio Day v2.0 follows a 22-phase roadmap:
- Phase 1: Audit + Backup (COMPLETE)
- Phase 2: Design System — Dark + Light (COMPLETE)
- Phase 3: App Shell + Navigation (COMPLETE)
- Phase 4: Today / Home (CURRENT / NOT COMPLETE)
- Phases 5-22: NOT COMPLETE

**Product Direction:**
- **Posts:** Remain in Discover section (not removed or relocated)
- **Stories:** Today-only experience (not duplicated into Discover)
- **Discover:** Central hub for finding meaningful activities including Posts, Activities, Challenges, People, Projects/Builds, Competition, Topics/Interests
- **Mobile Posts:** Horizontal swipe interface, one post at a time (not endless vertical feed)
- **Content Seeding:** Pre-launch ecosystem with 40+ challenges per field (50+ preferred) to ensure immediate value for new users
- **Recommendation System:** Interest + difficulty + time match + previous completion + recent behavior + freshness + community activity + quality + creator reputation - skip/hide/report signals

**Architecture & Stack:**
- Frontend: Cloudflare (static HTML/CSS/JS/PWA)
- Backend: Google Cloud Run (Python/Flask) - Worker → Flask migration in progress (Phase 13)
- Data: Firebase Firestore
- Auth: Firebase Authentication
- Media: Cloudinary (unsigned uploads)
- Preserved Services: Firebase Auth, Firestore, Cloudinary (no migration planned during current phases)

**Git Workflow:**
- Stable branch: master (production-ready)
- Development: Always in phase branches
- Standard flow: master → phase branch → work → review → merge to master
- Critical: Never merge phase branches into master without review; never force-push; preserve history

**Security & Privacy Principles:**
- Never expose private chats, profile/activity data, notifications, or Firestore data
- Never trust client for XP, level, completion rewards, admin privileges, or private data access
- Server-side validation for all security-critical operations
- Privacy-first design with clear data lifecycle policies

**Testing & Quality Assurance:**
- Automated testing required for backend (auth, authorization, API, validation, rate limits)
- Frontend testing for critical interactions, theme consistency, responsive behavior
- Security testing for unauthorized access, wrong-user access, admin-only functions, token validation
- Cross-browser/device testing, accessibility verification, performance optimization

WHAT'S NEW IN v1.1 (Gamification)
----------------------------------
- Tasks hub (tasks.html): daily / weekly / monthly from CENTRAL templates
- Progress only: users/{uid}/progress/{periodKey} — NOT one doc per daily task
- Community tasks + challenges: any logged-in user creates from templates; join, like, comment, complete, follow creator
- Admins moderate only: feature / hide / archive / remove (not required to create)
- XP, levels, streaks, badges on profile
- Leaderboards: global, friends, weekly, monthly, streak
- App-open reminders (task / streak / challenge) + OneSignal via existing worker
- Admin page (admin-tasks.html) gated by config/admins
- Auto-metrics: posts / likes / comments bump matching task progress

Modular folders:
  gamification/   — XP, streaks, badges, templates, progress, community, boards, reminders
  ui/             — tasks.css, achievements popup, nav helper


FIREBASE SETUP (MANUAL)
------------------------
1) Create Firestore document:
   Collection: config
   Document ID: admins
   Field: uids (array of strings) = your Firebase Auth UID(s)
   Example: { "uids": ["abc123YourUid"] }

2) Firestore → Rules → paste entire firebase-rules.txt → Publish

3) If Console asks for indexes (communityTasks status+kind+createdAtMs),
   click the link in the error and create them.

4) Hard refresh the site: Ctrl + Shift + R

5) Optional: workers/gamification-cron.js for offline cleanup/reminders
   (app-open reminders already work without this)

Existing notes:
- Apply firebase-rules.txt before testing chat/connect/comments on fresh project.
- Images use Cloudinary unsigned preset trio_uploads — Firebase Storage / Blaze not required.
- Push: notifications.js → Cloudflare Worker (workers/send-push.js) → OneSignal
- Keep images compressed (free-plan style).