TRIO DAY 2.0 — Action Platform
================================

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

TECH STACK
----------
Frontend: HTML, CSS (vanilla, ES modules), JS (vanilla, ES modules), PWA
Backend: Cloudflare Workers (gamification, notifications, task reminders, AI proxy)
         Firebase Functions (minimal)
Auth: Firebase Authentication
Database: Cloud Firestore
Media: Cloudinary (unsigned uploads)
Push: OneSignal via Cloudflare Worker proxy
Hosting: Cloudflare Pages (static) + Cloudflare Workers (API)

---

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