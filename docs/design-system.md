# FocusFlow — Design System & Visual Foundation

**Version:** 1.0.0 (Phase 3 — Design System & Application Shell)  
**Date:** 2026-09-17  
**Status:** Approved Visual Specification  

---

## 1. Product Visual Direction & Design Principles

FocusFlow is a high-performance productivity platform designed for sustained periods of deep work. The interface is purposefully **calm, minimal, premium, and distraction-free**.

### 1.1 Core Principles
1. **Content Hierarchy Over Decoration:** No superfluous illustrations, visual noise, or heavy gradients. Information architecture guides the user directly to active tasks.
2. **Obvious Focus Actions:** The primary Pomodoro timer and start actions are unambiguous and immediately reachable.
3. **Calm Palette:** Deep, eye-strain-reducing slate/zinc tones in dark mode, and soft stone/white tones in light mode, with an energetic but restrained indigo accent (`hsl(239 84% 67%)`).
4. **Information Density Adaptability:** The timer screen is spacious and calm; analytics and task lists are structured with higher informational density for fast scanning.
5. **Zero Layout Shift Theme Switching:** Transitions between Light, Dark, and System modes maintain exact element geometries and visual weights.
6. **Accessibility by Default:** WCAG 2.1 AA contrast compliance, explicit focus indicators, semantic ARIA roles, full keyboard navigability, and respect for `prefers-reduced-motion`.

---

## 2. Design Tokens

### 2.1 Color Tokens (CSS Variables in HSL)

| Token | Light Value | Dark Value | Purpose |
|---|---|---|---|
| `--background` | `210 20% 98%` (Soft warm white) | `224 25% 6%` (Deep slate) | App canvas |
| `--foreground` | `224 71% 4%` (Slate 950) | `210 20% 98%` (Slate 50) | Primary text |
| `--card` | `0 0% 100%` (Pure white) | `224 22% 9%` (Elevated slate) | Cards, panels, modals |
| `--primary` | `239 84% 67%` (Indigo 500) | `239 84% 67%` (Indigo 500) | Focus action CTA, brand |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary button |
| `--secondary` | `220 14% 94%` | `223 16% 15%` | Secondary button, chips |
| `--muted` | `220 14% 94%` | `223 16% 15%` | Subtle containers, track bars |
| `--muted-foreground` | `220 9% 45%` | `217 10% 60%` | Subtitles, helper text |
| `--border` | `220 13% 88%` | `223 16% 18%` | Subtle container outlines |
| `--ring` | `239 84% 67%` | `239 84% 67%` | Keyboard focus indicator |
| `--success` | `142 71% 45%` | `142 70% 40%` | Completed Pomodoros, positive streaks |
| `--warning` | `38 92% 50%` | `38 92% 50%` | Approaching limits |
| `--destructive` | `0 84% 60%` | `0 63% 50%` | Abandonment, deletions |

### 2.2 Typography Scale
- **Primary Body Font:** Geist Sans (with system fallback: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto`)
- **Monospace Display Font:** Geist Mono (with `font-mono tabular-nums` for non-jittering countdown numbers)

| Style | Tailwind Classes | Size / Weight | Usage |
|---|---|---|---|
| **Timer Display** | `font-mono text-7xl sm:text-9xl font-bold tracking-tighter tabular-nums` | 72px / 128px Bold | Active countdown display |
| **Page Title (H1)** | `text-2xl sm:text-3xl font-bold tracking-tight` | 24px / 30px Bold | Top of each route shell |
| **Section Title (H2)** | `text-base sm:text-lg font-semibold tracking-tight` | 16px / 18px Semi-Bold | Card headers, table groups |
| **Body (Default)** | `text-sm leading-relaxed text-foreground` | 14px Regular | Task descriptions, body text |
| **Metadata / Labels** | `text-xs font-medium text-muted-foreground` | 12px Medium | Timestamps, counters, badges |
| **Small / Micro** | `text-[10px] font-semibold uppercase tracking-wider` | 10px Semi-Bold | Mobile nav labels, tag pills |

### 2.3 Border Radius Scale
- `rounded-sm`: `calc(var(--radius) - 4px)` (0.375rem / 6px) — Inputs, badges
- `rounded-md`: `calc(var(--radius) - 2px)` (0.5rem / 8px) — Buttons, dropdown items
- `rounded-lg`: `var(--radius)` (0.625rem / 10px) — Cards, modals
- `rounded-xl`: `0.75rem` (12px) — Shell containers, dialogs
- `rounded-full`: `9999px` — Avatars, pills, status dots

### 2.4 Motion & Transitions
- **Fast:** `100ms ease-out` — Button presses, active state scaling (`active:scale-[0.98]`).
- **Normal:** `200ms ease-in-out` — Dropdown menus, modal fades, hover color shifts.
- **Emphasis:** `300ms cubic-bezier(0.16, 1, 0.3, 1)` — Progress bar animations, toast slide-in.
- **Accessibility Invariant:** `@media (prefers-reduced-motion: reduce)` zeroes out transition and animation durations globally.

---

## 3. Component Library Inventory

Located in [`src/components/ui/`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/focusflow-app/src/components/ui/):

1. **`Button`**: Variants (`default`, `secondary`, `outline`, `ghost`, `destructive`, `success`, `link`), sizes (`sm`, `md`, `lg`, `icon`), built-in spinner loading state.
2. **`Input`**: Accessible HTML input with focus ring, error border, disabled styles.
3. **`Textarea`**: Multiline text input for markdown notes and descriptions.
4. **`Select`**: Native select with custom chevron indicator and focus ring.
5. **`Switch`**: Accessible toggle switch with space/enter keyboard interaction.
6. **`Checkbox`**: Accessible custom checkbox with SVG checkmark.
7. **`Badge`**: Variants (`default`, `secondary`, `outline`, `success`, `warning`, `destructive`) for status and priority tags.
8. **`Avatar`**: Image avatar with automatic two-letter fallback initials.
9. **`Card` Family**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
10. **`Tabs` Family**: Accessible tabbed interface with ARIA role attributes and active indicator.
11. **`Progress`**: Accessible progress bar with `aria-valuenow`.
12. **`Separator`**: Horizontal or vertical divider with decorative ARIA role.
13. **`Skeleton`**: Pulsing placeholder for loading states.
14. **`Spinner`**: Animated loader icon with screen-reader text.
15. **`Alert`**: Status alert with icons for default, destructive, success, and warning.
16. **`Dialog`**: Modal dialog with dark backdrop, escape key support, and scroll lock.
17. **`Toast`**: Context provider and `useToast()` hook with auto-dismissal.

---

## 4. Product-Level Common Components

Located in [`src/components/common/`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/focusflow-app/src/components/common/):

- **`PageHeader`**: Standardized page title, description, and action button slot.
- **`SectionHeader`**: Sub-section header with title and optional action link.
- **`StatCard`**: Overview metric card with icon, number, label, and trend chip.
- **`EmptyState`**: Standardized empty state with icon, explanatory title, description, and primary CTA.
- **`ErrorState`**: Standardized error container with alert icon, recovery message, and retry button.
- **`LoadingState`**: Spinner, card, or list skeleton loader.
- **`ConfirmDialog`**: Action confirmation modal for destructive operations.
- **`SearchField`**: Search input with magnifying glass and quick-clear `X` button.
- **`UserMenu`**: User avatar menu with theme switch, links, and sign-out action.
- **`NotificationCenter`**: Notification trigger and dropdown list.

---

## 5. Application Shell & Responsive Navigation

Located in [`src/components/layout/`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/focusflow-app/src/components/layout/):

### 5.1 Desktop Shell ($\ge 768\text{px}$)
- **Sidebar (`w-64`):** Fixed on the left, containing brand header, navigation links with active highlighting, badge counters, and settings link.
- **Top Header (`h-16`):** Sticky at the top, housing the global search shortcut (`⌘K`), theme switcher, notification bell, and user avatar menu.
- **Main Container:** Max width `7xl` (`80rem` / `1280px`), responsive padding (`px-4 sm:px-6 md:px-8`).

### 5.2 Mobile Shell ($< 768\text{px}$)
- **Top Header:** Slim mobile header displaying the brand logo, notification bell, and user avatar.
- **Bottom Navigation (`h-16`):** Fixed at screen bottom with 5 primary touch destinations: Dashboard, Focus, Tasks, Projects, Analytics.
- **Touch Target Compliance:** Every interactive touch target exceeds $44\times 44\text{px}$ to ensure one-handed mobile ergonomics.
- **Bottom Content Clearance:** `pb-24` on mobile avoids content being obscured by the bottom navigation bar.

---

## 6. Route Shell Inventory

All core routes have been implemented with clean visual hierarchy, zero fake numbers, and appropriate empty/loading states:

| Route | Purpose | Key UI Components |
|---|---|---|
| **`/`** | Public Landing & Value Proposition | Hero, Zero-drift architecture explanation, Workspace launch CTA, Footer |
| **`/dashboard`** | Authenticated Workspace Overview | Stat cards, Quick-start focus banner, Priority tasks preview, Goal progress |
| **`/focus`** | Distraction-Free Focus Timer | 7xl/9xl tabular-nums timer, Focus/Short/Long break tabs, Task context selector, Cycle dots, Controls |
| **`/tasks`** | Task Management Interface | Search field, Status tab filters, Task list container, Create Task modal dialog |
| **`/projects`** | Project Management | Color-tagged project cards, Create Project modal dialog with 8-color palette |
| **`/analytics`** | Productivity Analytics | Today/Week/Month range selector, Stat cards, Daily trend chart container, Project breakdown container |
| **`/settings`** | Preferences & Configuration | Timer durations, Audio toggles, Desktop notification toggle, Theme switcher, IANA timezone selector |
