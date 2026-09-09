# Changelog — Trio Day

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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