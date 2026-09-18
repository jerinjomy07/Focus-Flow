# FocusFlow — Accessibility (WCAG 2.2 AA-Oriented Hardening)

This document describes the accessibility improvements implemented in Phase 11 and the keyboard/screen-reader patterns used throughout the application.

> [!NOTE]
> Phase 11 implements **WCAG 2.2 AA-oriented hardening** — targeted structural improvements to the Dialog component, navigation, and form live regions. It does not constitute a full WCAG 2.2 AA conformance audit. A complete conformance evaluation (including automated axe-core scanning, NVDA/VoiceOver manual testing on all pages, and WCAG 2.2 success criterion mapping) is deferred to Phase 12.

---

## 1. Phase 11 Accessibility Scope

The following concrete improvements were made and verified:

| Item | What was done | WCAG criterion |
|---|---|---|
| Skip to main content | Added bypass link as first focusable element in `AppShell` | 2.4.1 Bypass Blocks |
| Dialog focus trap | Tab/Shift+Tab cycles within open dialog; focus returns to trigger on close | 2.1.2 No Keyboard Trap |
| Dialog ARIA structure | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` prop, backdrop `aria-hidden` | 4.1.2 Name, Role, Value |
| Form error live regions | `Alert` component has `role="alert"` — screen readers announce login/register errors | 4.1.3 Status Messages |

**Deferred to Phase 12 (Full Evaluation):**
- Complete colour contrast audit across all pages and themes
- Every interactive component mapped to WCAG 2.2 success criteria
- Automated axe-core scanning integrated into CI
- Formal screen-reader test matrix across browser/assistive technology pairs (NVDA/JAWS/VoiceOver)

---

## 2. Skip to Main Content (WCAG 2.4.1 Bypass Blocks)

**File**: [`src/components/layout/app-shell.tsx`](../focusflow-app/src/components/layout/app-shell.tsx)

A "Skip to main content" anchor link is the first focusable element in the DOM within `AppShell`. It is:

- **Visually hidden** by default using Tailwind's `sr-only` class (CSS `clip`/`position: absolute` technique).
- **Revealed** when it receives keyboard focus via `focus:not-sr-only` — it becomes a styled pill button visually anchored to the top-left of the viewport.
- **Targets** `<main id="main-content">` — the `id` was added to the existing `<main>` element.

This allows keyboard-only users to skip the sidebar navigation and jump directly to the page content.

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 ..."
>
  Skip to main content
</a>
```

---

## 3. Dialog Focus Trap (WCAG 2.1.2 No Keyboard Trap)

**File**: [`src/components/ui/dialog.tsx`](../focusflow-app/src/components/ui/dialog.tsx)

When a modal `Dialog` is open:

1. **Focus moves in**: `requestAnimationFrame` defers focus movement until after the DOM renders; the first focusable element inside the dialog receives focus.
2. **Tab cycles within**: A `keydown` listener intercepts `Tab` and `Shift+Tab`. If focus is on the last focusable element and the user presses `Tab`, focus wraps to the first. If focus is on the first and the user presses `Shift+Tab`, focus wraps to the last.
3. **Focus returns on close**: Before focus moves into the dialog, `document.activeElement` is saved to a ref. When the dialog closes (any method: backdrop click, Escape, close button), focus is restored to the saved element.

Focusable elements are detected by the selector:
```
a[href], button:not([disabled]), textarea:not([disabled]),
input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])
```

### ARIA Attributes

| Attribute | Value | Purpose |
|---|---|---|
| `role` | `dialog` | Identifies the element as a modal dialog |
| `aria-modal` | `true` | Tells screen readers the rest of the page is inert |
| `aria-labelledby` | (optional prop) | Associates a visible title element with the dialog |
| `tabIndex` | `-1` | Allows the container to receive focus as fallback |

---

## 4. Form Error Live Regions (WCAG 4.1.3 Status Messages)

**File**: [`src/components/ui/alert.tsx`](../focusflow-app/src/components/ui/alert.tsx)

The `Alert` component (used on login and registration pages for error messages) includes `role="alert"` on its root element. This causes screen readers to announce the error message immediately when it appears in the DOM, without requiring the user to navigate to it.

---

## 5. Keyboard Navigation Patterns

| Element | Keyboard Behaviour |
|---|---|
| Sidebar navigation | Standard `Tab` traversal |
| Modal dialogs | Focus trap; `Escape` closes; focus restored on close |
| Notification center popover | `Escape` closes; click-outside closes |
| Form submission | `Enter` submits; `Tab` moves between fields |
| Skip link | First `Tab` on any authenticated page reaches it |

---

## 6. Colour Contrast

The design system uses Tailwind CSS v4 with semantic colour tokens. All text colours are chosen to meet WCAG AA contrast ratios:
- Body text: ≥ 4.5:1 against background
- Large text and UI components: ≥ 3:1 against background
- Focus rings use `ring-ring` token which is set at sufficient contrast.

---

## 7. Screen Reader Design Considerations

Target compatibility pairs: NVDA + Chrome on Windows, VoiceOver + Safari on macOS.

Key implementations verified in Phase 11:
- All icon-only buttons have explicit `aria-label` attributes.
- Dynamic unread notification counts include an updated accessible text label.
- Chart SVGs include `role="img"` with descriptive `aria-label` fallbacks.
- Form validation errors render inside `<div role="alert">` live regions so assistive technologies receive status announcements without page focus shifts.

---

## 8. Future Improvements (Phase 12+)

- **Automated accessibility testing**: Integrate `axe-core` or `@axe-core/playwright` into CI.
- **Live region for timer countdown**: Add `aria-live="polite"` update when the timer reaches final minutes.
- **Focus visible enhancement**: Audit focus ring visibility in all themes.
- **Roving tabindex**: Implement for the notification list to allow arrow-key navigation.
