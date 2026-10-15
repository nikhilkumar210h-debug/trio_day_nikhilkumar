# Trio Day UI/UX Audit & Redesign Plan

## Executive Summary
Trio Day is a challenge-first social platform with a unique interaction loop: Challenge → Choose → Compare → Discuss → Connect. The codebase uses vanilla HTML/CSS/JS with Firebase backend and Cloudflare Workers hosting. The design system is well-structured with semantic tokens but needs cohesive application across all pages.

---

## Current State Analysis

### Strengths
- Semantic design token system (tokens.css) with dark/light theme support
- Mobile-first responsive design with 4px spacing scale
- Good typography choices (Space Grotesk display + Inter UI)
- Comprehensive component library in style.css
- Firebase integration with proper offline-first patterns
- Unique "tricolor strip" brand element
- Challenge loop logic is well-implemented in challenge.js

### Critical Issues

#### 1. Challenge Page (Core Experience) - **HIGHEST PRIORITY**
- **Inline styles in challenge.html**: 69 lines of inline CSS mixing with external stylesheets
- **Inconsistent card styling**: Challenge cards use custom classes (`.challenge-main-card`, `.challenge-tag`, etc.) that don't align with the design system in `style.css`
- **Tiny typography**: Font sizes as small as 7-9px in discussion threads, making content unreadable
- **Cluttered action bar**: 4 buttons + next challenge link in `.challenge-links` creates decision paralysis
- **Detective Mystery feature**: Clue reveal UI is cramped and hard to discover
- **Results visualization**: Bar charts lack proper accessibility and visual hierarchy
- **Discussion threading**: Reply nesting is too compact (1px border-left), hard to follow

#### 2. Home Page (index.html)
- **Greeting section**: Grid layout breaks on mobile, visual element (orbit) feels disconnected
- **Today's Focus**: Multiple competing sections (daily question, friend streak, todayFocus, todayLive) create cognitive load
- **Stories strip**: Horizontal scroll with gradient border is nice but preview images lack context
- **Skeleton loading**: Inconsistent skeleton types across sections

#### 3. Navigation
- **Bottom nav (mobile)**: 5 items but `grid-template-columns: repeat(5, minmax(0, 1fr))` creates cramped touch targets
- **Side rail (desktop)**: Appears on all pages but active state styling uses `!important` inline styles
- **Duplicate nav rendering**: Both bottom-nav and nkm-rail rendered, causing flash on load

#### 4. Chat & Private Chat
- **Message bubbles**: `.temp-message.mine` uses `margin-left: auto` but lacks visual distinction for outgoing vs incoming
- **Sender identity**: No consistent sender name display above messages in group chats
- **Composer**: Fixed bottom composer could conflict with virtual keyboard on mobile
- **Conversation list**: Shows only 20 conversations, no pagination/infinite scroll

#### 5. Profile Page
- **Progress section**: XP bar, streak shield, badges all compete for attention
- **Connections tabs**: Custom styling doesn't match design system tabs
- **Activity cards**: Inconsistent with challenge card design language

#### 6. Design System Inconsistencies
- **Legacy variables**: Many pages still use `--bg`, `--surface`, `--ink`, `--border` instead of semantic tokens
- **Button variants**: Multiple button styles (`.nkm-btn`, `.btn`, `.action-btn`, `.hero-btn`, `.activity-action`) with overlapping responsibilities
- **Focus states**: Inconsistent focus ring implementation
- **Z-index conflicts**: Modal (300) vs Toast (400) vs Tooltip (500) - but some components use hardcoded values

#### 7. Accessibility Gaps
- **Color contrast**: Some muted text (`--color-ink-dim`) may not meet WCAG AA on both themes
- **Focus indicators**: Some interactive elements lack visible focus styles
- **ARIA labels**: Missing on several icon-only buttons
- **Reduced motion**: Not consistently respected across all animations

---

## Redesign Strategy

### Phase 1: Design Token Refinement (Foundation)
- Consolidate all legacy variable usage to semantic tokens
- Add missing semantic tokens for challenge-specific states
- Ensure WCAG AA contrast in both themes
- Standardize spacing, typography, and component tokens

### Phase 2: Challenge Experience Redesign (Core Product)
- **Challenge Card**: Redesign as primary content unit with clear visual hierarchy
  - Larger question text (minimum 16px)
  - Clear answer options with proper touch targets (48px minimum)
  - Visible selection state with brand color
  - Community results as progressive disclosure
  - Discussion as secondary but accessible action
- **Answer Selection**: Immediate visual feedback, prevent double-submit
- **Results Visualization**: Accessible bar charts with proper labels
- **Discussion Thread**: Better visual hierarchy, readable reply nesting
- **Detective Mystery**: Feature as special challenge variant with dedicated styling

### Phase 3: Home Page Refinement
- Simplify to 3 primary sections: Greeting, Today's Challenge, Live Community
- Make "Today's Challenge" the hero - single focus card
- Improve story strip with better preview/context
- Consistent skeleton loading

### Phase 4: Navigation & Shell
- Unify bottom nav and side rail rendering
- Improve touch targets (48x48px minimum)
- Consistent active state styling via CSS variables
- Remove flash on navigation render

### Phase 5: Chat & Messages
- Redesign message bubbles with clear inbound/outbound distinction
- Add sender names in group conversations
- Improve composer UX on mobile
- Better empty states

### Phase 6: Profile & Social
- Reorganize profile into clear sections: Identity, Progress, Activity, Connections
- Consistent card styling with challenge cards
- Improve connections/followers UI

### Phase 7: Cross-cutting Polish
- Micro-interactions (press states, hover, loading)
- Empty states with actionable next steps
- Error states with recovery actions
- Reduced motion support everywhere
- Performance: lazy load images, debounce scroll handlers

---

## File Mapping for Implementation

| Area | Files to Modify | Priority |
|------|----------------|----------|
| Design Tokens | `public/styles/tokens.css` | P0 |
| Challenge Feed | `public/challenge.html`, `public/challenge.js`, `public/style.css` | P0 |
| Home Page | `public/index.html`, `public/script.js`, `public/styles/polish.css` | P0 |
| Navigation | `public/ui/nav.js`, `public/styles/nav.css` | P1 |
| Chat/Private Chat | `public/chat.html`, `public/chat.js`, `public/chat.css`, `public/private-chat.*` | P1 |
| Profile | `public/profile.html`, `public/profile.js`, `public/profile.css` | P1 |
| Components | `public/styles/components.css`, `public/styles/sheet.css` | P1 |
| Challenge Create | `public/challenge-create.html`, `public/challenge-create.js` | P2 |
| Settings/Other | `public/settings.html`, `public/settings.js` | P2 |

---

## Reference Patterns Adapted

| Reference | Pattern | Trio Day Adaptation |
|-----------|---------|---------------------|
| Reddit | Vote/selection affordance | Answer option buttons with clear selected state |
| Reddit | Comment threading | Discussion replies with visual nesting |
| Reddit | Content density | Compact but readable challenge cards |
| Discord | Message bubbles | Inbound/outbound distinction in chat |
| Discord | Server/channel list | Challenge category filters as tabs |
| Discord | User presence | Online indicators in challenge discussions |

---

## Success Metrics
- Challenge participation rate (answer selection → discussion → opposite chat)
- Time to first interaction on challenge page
- Mobile usability score (touch targets, readability)
- Accessibility audit score (WCAG AA)
- Visual consistency across all pages
- No regression in existing functionality