# ADR-003: Zustand for Timer Store over Redux / Context

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

The timer requires fast, synchronous client-side state management. Timer display must update ~60 fps via requestAnimationFrame. The timer state must also be readable by multiple components (timer display, task selector, session controls, navigation indicator) without prop drilling.

Options considered:
1. **React Context + useReducer** — built-in, no dependency
2. **Zustand** — lightweight state management library
3. **Redux Toolkit** — heavyweight state management
4. **Jotai** — atomic state management

## Decision

Use **Zustand** for the timer store.

## Rationale

### Why not Context + useReducer

- Every timer state update causes all Context consumers to re-render
- Timer ticks at ~60fps → excessive re-renders across the component tree
- Performance problems are predictable and documented with Context for high-frequency updates
- Would require heavy use of `useMemo`/`useCallback` and `React.memo` to compensate

### Why not Redux Toolkit

- Overkill for this use case
- Adds significant boilerplate
- Large bundle addition for a single-store timer
- Excellent tool for large teams but unnecessary here

### Why Zustand

- Tiny bundle (1.5kB)
- Subscriptions are selector-based — components only re-render when their slice of state changes
- Timer display component can subscribe only to `remainingTime` (derived, not stored) without re-rendering on task changes
- Synchronous updates (no dispatch overhead)
- Simple API, easy to test
- Supports middleware (devtools, persist for sessionStorage)

### Why not Jotai

- Zustand's single store model is a better fit for the timer's interconnected state
- Jotai's atomic model is better suited for independent, widely distributed state
- Zustand has broader adoption and more examples for this exact use case

## Trade-offs Accepted

- External dependency (small, but real)
- Zustand store state is not tracked by React DevTools unless explicitly configured (devtools middleware solves this)

## Consequences

- Timer state machine lives in `stores/timer-store.ts`
- Timer display is a leaf component that subscribes only to the time display slice
- Store is typed with explicit interfaces matching the timer domain types
- `persist` middleware writes active session to sessionStorage for refresh recovery (secondary to server-side recovery)
