# Trio Day - Design Tokens Reference

> Extracted from public pages of WhatsApp Web, Duolingo, Instagram, Linktree, Notion (2026-10-18)
> **No code, logos, or branding copied** — only patterns extracted.

---

## Color Palette

### Primary CTA Color
- **Duolingo**: `#58CC02` (green) — high visibility, used for primary actions
- **WhatsApp Web**: `#008069` (teal) — brand color for primary actions
- **Instagram**: `#E1306C` (pink/gradient) — brand gradient for CTAs
- **Linktree**: `#393939` (near black) — neutral primary
- **Notion**: `#000000` (black) / `#FFFFFF` (white) — monochrome primary

**Trio Day Decision**: `#8B5CF6` (purple/violet) — existing brand primary, keep as `--color-primary`

### Accent Color
- **Duolingo**: `#FFCB05` (yellow) — streaks, rewards, highlights
- **WhatsApp Web**: `#25D366` (green) — online status, sent messages
- **Instagram**: Gradient (purple → orange → yellow) — stories ring
- **Linktree**: `#E6E6E6` (light gray) — subtle backgrounds
- **Notion**: `#E9E9E7` (warm gray) — hover states, dividers

**Trio Day Decision**: `#F59E0B` (amber) — existing streak/XP color, keep as `--color-accent`

### Semantic Colors (Light/Dark)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-bg` | `#F8F7FF` | `#08051A` | Page background |
| `--color-surface` | `#FFFFFF` | `#17113A` | Cards, modals, inputs |
| `--color-surface-elevated` | `#FFFFFF` | `#1E1640` | Popovers, dropdowns |
| `--color-border` | `#E0D8FF` | `rgba(196,181,253,.14)` | Dividers, input borders |
| `--color-ink` | `#1E1B2E` | `#F1F5F9` | Primary text |
| `--color-ink-muted` | `#6B6B8A` | `#94A3B8` | Secondary text |
| `--color-ink-dim` | `#A0A0B8` | `#64748B` | Disabled/placeholder text |
| `--color-primary` | `#8B5CF6` | `#A78BFA` | Primary CTA, links, focus |
| `--color-primary-strong` | `#6366F1` | `#818CF8` | Hover/active primary |
| `--color-primary-soft` | `#EDE9FE` | `rgba(139,92,246,.15)` | Primary backgrounds, pills |
| `--color-primary-text` | `#FFFFFF` | `#FFFFFF` | Text on primary |
| `--color-accent` | `#F59E0B` | `#FBBF24` | Streaks, XP, warnings |
| `--color-success` | `#10B981` | `#34D399` | Success states |
| `--color-error` | `#EF4444` | `#F87171` | Error states |
| `--color-warning` | `#F59E0B` | `#FBBF24` | Warning states |

---

## Spacing Scale (8px base)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | `0` | Reset |
| `--space-1` | `4px` | Micro spacing, icon gaps |
| `--space-2` | `8px` | Base unit, inline gaps |
| `--space-3` | `12px` | Small component padding |
| `--space-4` | `16px` | Standard padding, card gutters |
| `--space-5` | `20px` | Medium spacing |
| `--space-6` | `24px` | Section padding, card padding |
| `--space-7` | `28px` | Large spacing |
| `--space-8` | `32px` | Section gaps |
| `--space-10` | `40px` | Major section gaps |
| `--space-12` | `48px` | Page margins |
| `--space-16` | `64px` | Hero sections |

**Reference patterns:**
- **WhatsApp**: 12px base padding, 8px gaps in chat list
- **Duolingo**: 16px base, 24px card padding, generous whitespace
- **Instagram**: 12px base, 16px card padding, tight feed
- **Linktree**: 24px base, generous vertical rhythm
- **Notion**: 16px base, 24px block padding, very generous

---

## Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--r-none` | `0` | Sharp corners |
| `--r-sm` | `4px` | Badges, pills, small chips |
| `--r-md` | `8px` | Buttons, inputs, small cards |
| `--r-lg` | `12px` | Standard cards, modals |
| `--r-xl` | `16px` | Large cards, sheets |
| `--r-2xl` | `24px` | Hero cards, major containers |
| `--r-full` | `9999px` | Pills, avatars, FABs |

**Reference patterns:**
- **WhatsApp**: 8px buttons, 20px message bubbles, 50% avatars
- **Duolingo**: 12px buttons, 16px cards, 50% avatars, 9999px pills
- **Instagram**: 8px buttons, 12px cards, 50% avatars
- **Linktree**: 12px buttons, 16px cards, 9999px link buttons
- **Notion**: 4px buttons, 8px cards, 12px modals

**Trio Day Decision**: Use `--r-md` (8px) for buttons, `--r-lg` (12px) for cards, `--r-xl` (16px) for sheets, `--r-full` for pills/avatars

---

## Typography Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | `10px` | 600 | 1.4 | Labels, badges, captions |
| `--text-sm` | `12px` | 400/500 | 1.5 | Body small, meta text |
| `--text-base` | `14px` | 400/500 | 1.5 | Body text |
| `--text-md` | `16px` | 400/500 | 1.5 | Large body, button text |
| `--text-lg` | `18px` | 600 | 1.4 | Subheadings |
| `--text-xl` | `20px` | 700 | 1.3 | Section titles |
| `--text-2xl` | `24px` | 700 | 1.2 | Page titles |
| `--text-3xl` | `28px` | 800 | 1.1 | Hero titles |
| `--text-4xl` | `34px` | 800 | 1.0 | Display titles |

**Font Families:**
- `--font-sans`: `'Inter', system-ui, sans-serif` — UI/Body
- `--font-display`: `'Space Grotesk', sans-serif` — Headings, brand
- `--font-mono`: `'JetBrains Mono', monospace` — Code, UIDs

**Reference patterns:**
- **WhatsApp**: 14-16px body, 16px buttons, system fonts
- **Duolingo**: 14-16px body, rounded display font (custom), heavy weights for gamification
- **Instagram**: 14px body, 16px buttons, system fonts
- **Linktree**: 16px body, 18px headings, Inter
- **Notion**: 15px body, 19px h3, 23px h2, 31px h1, Inter

---

## Button System

### Size Variants
| Variant | Height | Padding (H) | Font Size | Radius | Use Case |
|---------|--------|-------------|-----------|--------|----------|
| `--btn-xs` | `28px` | `8px` | `10px` | `--r-sm` | Icon-only, dense UI |
| `--btn-sm` | `36px` | `12px` | `12px` | `--r-md` | Secondary actions, inline |
| `--btn-md` | `44px` | `16px` | `14px` | `--r-md` | **Default** primary/secondary |
| `--btn-lg` | `52px` | `20px` | `16px` | `--r-lg` | Hero CTAs, full-width mobile |

### Style Variants
| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| Primary | `--color-primary` | `--color-primary-text` | none | Main CTA |
| Secondary | `--color-surface` | `--color-ink` | `--color-border` | Alternative actions |
| Ghost | `transparent` | `--color-ink` | none | Subtle actions |
| Danger | `--color-error` | `white` | none | Destructive |
| Outline | `transparent` | `--color-primary` | `--color-primary` | Subtle primary |

**Reference patterns:**
- **WhatsApp**: 44px height, 16px padding, 8px radius, teal primary
- **Duolingo**: 48px height, 24px padding, 12px radius, green primary, heavy weight
- **Instagram**: 36px height, 16px padding, 8px radius, blue primary
- **Linktree**: 48px height, 16px padding, 12px radius, black primary
- **Notion**: 36px height, 12px padding, 4px radius, black primary

**Trio Day Decision**: 
- Default: 44px height, 16px padding, 8px radius, 600 weight
- Primary: `--color-primary` bg, white text
- Secondary: surface bg, ink text, border

---

## Tap Targets
- **Minimum**: 44×44px (iOS HIG) / 48×48dp (Material)
- **Comfortable**: 48×48px
- **All interactive elements** must meet minimum

**Reference patterns:**
- All 5 apps meet 44×44px minimum
- Duolingo uses 48px+ for comfort
- Instagram uses 44px for nav bar items

---

## Motion / Animation

### Timing
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Micro-interactions, hover |
| `--duration-base` | `150ms` | **Default** transitions |
| `--duration-slow` | `250ms` | Modals, sheets, page transitions |
| `--duration-slower` | `350ms` | Complex animations |

### Easing
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | **Default** — natural deceleration |
| `--ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | Modal enter/exit |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful, bouncy (Duolingo-style) |

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Reference patterns:**
- **WhatsApp**: 150-200ms ease-out, minimal animation
- **Duolingo**: 200-300ms spring easing, playful bounces on rewards
- **Instagram**: 150ms ease-out, subtle scale on tap
- **Linktree**: 200ms ease-out, smooth hover
- **Notion**: 150ms ease-out, very subtle

**Trio Day Decision**: 150ms base, 250ms for sheets/modals, cubic-bezier(0.25, 0.46, 0.45, 0.94) default, respect `prefers-reduced-motion`

---

## Navigation Patterns

### Mobile (≤640px)
| App | Pattern | Items | Position |
|-----|---------|-------|----------|
| WhatsApp Web | Bottom tab bar | 4 (Chats, Status, Calls, Settings) | Fixed bottom |
| Duolingo | Bottom nav | 5 (Home, Path, Practice, Profile, Shop) | Fixed bottom |
| Instagram | Bottom nav | 5 (Home, Search, Reels, Shop, Profile) | Fixed bottom |
| Linktree | Stacked links | Variable | Scrollable |
| Notion | Sidebar (hamburger) | Variable | Slide-in from left |

**Trio Day Decision**: Bottom nav (5 items: Today, Discover, Challenge, Chat, You) — matches current implementation

### Desktop (≥840px)
| App | Pattern | Position |
|-----|---------|----------|
| WhatsApp Web | Left sidebar (chat list) | Fixed left |
| Duolingo | Left sidebar + top bar | Fixed left |
| Instagram | Left sidebar (nav) + right (insights) | Fixed sides |
| Linktree | Centered column | Center |
| Notion | Left sidebar (collapsible) | Fixed left |

**Trio Day Decision**: Left sidebar (collapsible) + top bar — matches current implementation

---

## Empty States

**Pattern**: Illustrative + Action-oriented
- **WhatsApp**: "No chats yet" + "Start a new chat" button
- **Duolingo**: Friendly mascot + "Start your first lesson" CTA
- **Instagram**: "No posts yet" + "Share your first post" button
- **Linktree**: "Add your first link" + large CTA button
- **Notion**: "This page is empty" + "Start typing" or template picker

**Trio Day Pattern**:
- Icon/illustration (emoji or simple graphic)
- Clear headline (16px, semibold)
- Helpful description (12px, muted)
- Primary CTA button (44px height)
- Generous padding (24px+)

---

## Skeleton / Loading States

**Pattern**: Shimmer or pulse animation matching content shape
- **WhatsApp**: Gray pulse bars matching message bubbles
- **Duolingo**: Rounded cards with shimmer matching lesson cards
- **Instagram**: Gray blocks matching post layout (avatar + image + actions)
- **Linktree**: Gray rounded rectangles matching link buttons
- **Notion**: Gray blocks matching block types (text, image, embed)

**Trio Day Decision**: 
- Use `--color-border` base with shimmer gradient
- Match actual content dimensions
- `animation: skeleton-shimmer 1.5s ease-in-out infinite`
- Respect `prefers-reduced-motion`

---

## Shadows / Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,.05)` | Subtle borders |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)` | Cards, dropdowns |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06)` | Modals, sheets |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,.1), 0 4px 6px rgba(0,0,0,.05)` | Popovers, toasts |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,.1), 0 10px 10px rgba(0,0,0,.04)` | Major modals |

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | `1` | Base content |
| `--z-sticky` | `100` | Sticky headers |
| `--z-dropdown` | `200` | Dropdowns, popovers |
| `--z-modal` | `400` | Modals, sheets |
| `--z-toast` | `500` | Toasts, notifications |
| `--z-tooltip` | `600` | Tooltips |

---

## Breakpoints

| Token | Value | Usage |
|-------|-------|-------|
| `--bp-sm` | `480px` | Small mobile |
| `--bp-md` | `640px` | Mobile / tablet |
| `--bp-lg` | `840px` | Tablet / desktop (sidebar shows) |
| `--bp-xl` | `1040px` | Content max-width |
| `--bp-2xl` | `1280px` | Large desktop |

---

## Implementation Checklist

### CSS Variables (in `styles/tokens.css`)
- [ ] All color tokens defined for both light/dark
- [ ] Spacing scale tokens
- [ ] Radius scale tokens
- [ ] Typography scale tokens
- [ ] Button size/style tokens
- [ ] Motion tokens
- [ ] Shadow tokens
- [ ] Z-index tokens
- [ ] Breakpoint tokens

### Component Updates
- [ ] Buttons use token variables
- [ ] Cards use token variables
- [ ] Inputs use token variables
- [ ] Navigation uses token variables
- [ ] Modals/sheets use token variables
- [ ] Skeletons use token variables
- [ ] Empty states use token variables

### Today Page Polish
- [ ] One clear primary action above fold (Challenge CTA)
- [ ] Reduce cards: max 3 sections visible without scroll
- [ ] Sections: Greeting → Daily Question/Brain Sprint → Challenge
- [ ] Move Trio Pulse below fold or make collapsible

---

## Free-Tier Safe Notes
- All tokens are CSS-only — no runtime cost
- No new dependencies
- Variables work in all modern browsers
- `prefers-reduced-motion` is native CSS