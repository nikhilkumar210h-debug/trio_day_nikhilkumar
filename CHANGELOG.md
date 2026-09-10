# Changelog — Trio Day

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-phase3] - 2026-09-10

### Added
- **Canonical 5-Item Navigation** (`public/ui/nav.js`, `public/styles/nav.css`): Today / Discover / Do / Chat / You across desktop (left rail) and mobile (bottom nav + floating Create FAB)
- **Global Theme Bootstrap** (inline `<script>` in all 20 HTML pages): Pre-paint `data-theme` resolution from localStorage/system preference — eliminates FOUC
- **Theme System Unification** (`public/theme.js`): Single `trio-theme` key (migrates legacy `trio_theme`), loaded on every shell page, auto-injects toggle via header.js
- **Light Theme Visual Polish** (`public/styles/tokens.css`): Darker muted text (#334155), darker dim text (#64748b), stronger glass (0.08/0.12/0.16), borders (0.12/0.20), shadows (0.08-0.15) — WCAG AA compliant
- **Mobile Shell Hardening**: 5-column `minmax(0,1fr)` grid, floating Create FAB, safe-area insets, touch targets ≥44px, no `YOU` overflow at 320–414px
- **Desktop Rail**: 72px→240px responsive rail with content push, active state styling
- **Legacy CSS Cleanup**: `--nkm-surface/#141b2e` → `var(--color-surface)`, `--nkm-border` → `var(--color-border)`, `--nkm-radius-md` → `var(--radius-md)`, `--nkm-font-display` → `var(--font-display)` across shell CSS
- **All-Users Sidebar Fix** (`public/all-users.html`): Grid layout updated for ≥1280px rail width
- **Login Compatibility**: tokens.css loaded, legacy variable remap handles inline dark styles

### Changed
- **nav.js**: Complete rewrite for 5-item canonical nav + floating Create FAB + desktop rail
- **nav.css**: 5-col mobile grid, floating FAB, desktop rail responsive (72px/240px)
- **header.css**: Compact icon buttons on mobile, theme/chat/search integration
- **tokens.css**: Light theme primitives strengthened for contrast; legacy variable remap for `--bg/--surface/--ink/--border`
- **style.css**: Removed duplicate `[data-theme="light"]` block; hardcoded `#0b1220`/`rgba(0,0,0,0.6)` → semantic tokens
- **sheet.css**: Scrim background → `var(--color-glass-strong)`
- **ui/nav.js**: New canonical nav rendering, unified Create handler
- **tasks.js**: Removed independent `applyThemeToggle()` page theme state
- **script.js**: Removed hard-lock `setAttribute('data-theme','dark')`
- **create.js**: Removed hard-lock `setAttribute('data-theme','dark')`
- **All 20 HTML pages**: Added pre-paint theme bootstrap + theme.js module load

### Fixed
- **FOUC Prevention**: Inline bootstrap in `<head>` sets theme before paint
- **Theme Consistency**: Single global preference across all pages; no page-independent theme state
- **Mobile Nav Overflow**: `YOU` label never clips at 320–414px via `minmax(0,1fr)` grid
- **Mixed Dark/Light Sections**: Legacy inline `:root` blocks remapped via tokens.css light theme
- **All-Users Sidebar Overlap**: Grid uses rail width at ≥1280px, hidden below
- **Login Light Mode**: tokens.css loaded, legacy remap enables light theme
- **Hardcoded Dark Locks**: Removed from script.js, create.js, tasks.js

### Removed
- Duplicate `[data-theme="light"]` block from style.css (single source in tokens.css)
- Per-page theme toggles and hardcoded dark locks
- Legacy `--nkm-*` fallback patterns in shell CSS

### Security
- No changes to Firebase Auth, Firestore rules, or Cloudflare Workers
- No data migrations or deletions
- No Firestore schema changes

---

## [2.0.0-phase2] - 2026-09-09

### Added
- **Design Tokens** (`public/styles/tokens.css`): Complete semantic token system with 11 color tokens, spacing, typography, radii, shadows, control heights, avatar sizes, transitions, z-index, breakpoints
- **Theme System** (`public/theme.js`): Dark/light theme switching with localStorage persistence, system preference detection, meta theme-color updates
- **Theme Toggle** (`public/ui/header.js`): Theme toggle button in desktop header with ARIA support
- **Light Theme**: First-class light theme with intentionally designed colors (not inverted)
- **Component Library**: All components updated to use semantic tokens
  - Buttons: `.btn`, `.btn.primary`, `.btn.secondary`, `.btn.ghost`, `.btn.sm`, `.btn.lg`
  - Inputs: `.field input`, `.field textarea` with focus states
  - Cards: `.nkm-card`, `.feed-item`, `.profile-card`, `.private-chat-card`
  - Modals/Sheets: `.modal-overlay`, `.nkm-sheet` with slide-up animation
  - Tabs: `.media-source-tabs`, `.nkm-tabs`
  - Badges: `.nkm-badge`, `.story-badge`, `.connected-pill`
  - Toasts: `.app-alert` stack with slide-in animation
  - Skeletons: `.skeleton-card`, `.nkm-skeleton` with shimmer
- **Interactive States**: hover, active, focus-visible, disabled, success, error states for all components
- **Reduced Motion**: `prefers-reduced-motion` support disables all animations/transitions
- **Accessibility**: WCAG AA contrast, focus-visible outlines, ARIA labels, keyboard navigation

### Changed
- **tokens.css**: Completely rewritten with semantic token system (replaces old --nkm-* tokens)
- **style.css**: Removed duplicate token definitions; all component styles updated to use new semantic tokens
- **components.css**: All primitives updated to semantic tokens
- **header.css**: Updated to semantic tokens; backdrop-filter blur added
- **nav.css**: Bottom nav and desktop rail updated to semantic tokens
- **sheet.css**: Modal/sheet updated to semantic tokens; z-index from token scale
- **skeleton.css**: Skeleton and empty states updated to semantic tokens
- **home.css**: Feed, pulse, stories updated to semantic tokens
- **chat.css**: Chat hub and group panel updated to semantic tokens
- **private-chat.css**: Private chat updated to semantic tokens
- **voice-status.css**: Voice status updated to semantic tokens
- **index.html**: Added theme.js module script; removed hardcoded dark theme
- **auth-ui.js**: Removed hardcoded dark theme assignment
- **README.txt → README.md**: Updated with Phase 1 & 2 documentation

### Fixed
- Hardcoded `document.documentElement.setAttribute('data-theme', 'dark')` removed from script.js
- CSS custom property fallbacks cleaned up (e.g., `var(--nkm-surface, #141b2e)` → `var(--color-surface)`)
- Focus states now use consistent 3px ring with `--color-primary-soft`
- Mobile header now uses semantic tokens for background/backdrop

### Removed
- Duplicate token definitions in style.css (now single source in tokens.css)
- Hardcoded color values in component CSS files
- `--nkm-*` prefixed tokens (replaced by semantic `--color-*`, `--space-*`, `--radius-*`, etc.)

### Security
- No changes to Firebase Auth, Firestore rules, or Cloudflare Workers
- No data migrations or deletions

---

## [1.1.0] - 2026-09-08 (v1.1 Baseline)

### Added
- Gamification system: XP, levels, streaks, badges, leaderboards
- Tasks hub with daily/weekly/monthly templates
- Community tasks with join/like/comment/complete
- Admin moderation (feature/hide/archive)
- Auto-metrics for post/like/comment progress
- App-open reminders via OneSignal
- Cloudflare Workers: gamification, notifications, task reminders, AI proxy

### Changed
- Firebase rules updated for gamification protection
- Firestore schema extended with progress, badges, leaderboards

---

## [1.0.0] - 2026-09-07 (Initial v1.0)

### Added
- Posts, stories, voice status
- Private chat, group chat
- Notifications (in-app + push)
- Cloudinary image/video upload
- PWA with service worker
- Firebase Auth (email/password)