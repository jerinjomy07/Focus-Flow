# ADR-004: Recharts over Chart.js / Victory / Nivo

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

FocusFlow's analytics page requires several chart types:
- Line chart (daily focus time trend)
- Bar chart (focus time by day/project)
- Possibly a radial/donut chart (goal completion, session type distribution)

Options evaluated:
1. **Recharts** — React-native, SVG-based charting library
2. **Chart.js** — Canvas-based, framework-agnostic
3. **Victory** — React-native, SVG-based
4. **Nivo** — React-native, SVG-based with rich defaults
5. **Tremor** — UI library with built-in chart components

## Decision

Use **Recharts**.

## Rationale

| Factor | Recharts | Chart.js | Victory | Nivo |
|---|---|---|---|---|
| React-native | ✅ | ❌ (wrapper needed) | ✅ | ✅ |
| SVG output | ✅ | ❌ (canvas) | ✅ | ✅ |
| Bundle size | ~100kB gzip | ~60kB | ~150kB | ~200kB |
| TypeScript | Good | Good | Good | Excellent |
| Accessibility | SVG is accessible | Canvas is not | SVG accessible | SVG accessible |
| Customization | High | High | High | High |
| Community | Very large | Very large | Medium | Medium |
| Maintenance | Active | Active | Active | Active |

**Key reasons for Recharts:**
1. **SVG over canvas** — SVG elements are accessible to screen readers and can have ARIA labels; Chart.js canvas is not natively accessible
2. **React-native** — no wrapper component needed; integrates cleanly with React state
3. **Large community** — most StackOverflow questions and examples are for Recharts
4. **Composition API** — chart structure is composed from React components, not a config object; easier to type and customize

### Why not Chart.js

Canvas-based → accessibility problems. Screen readers cannot read canvas content. This violates NFR-A11Y-01 (WCAG 2.1 AA).

### Why not Nivo

Nivo's bundle is significantly larger. The extra features are not needed for FocusFlow's analytics scope.

### Why not Tremor

Tremor is a full UI library with chart components. Adding Tremor alongside shadcn/ui would introduce redundant component systems and stylistic conflicts. Charts are not complex enough to justify adding a full UI library.

## Trade-offs Accepted

- Recharts SVG charts can be heavy to render with very large datasets (1000+ data points) — mitigated by aggregating data before rendering (daily aggregates, not raw sessions)
- Some default Recharts styling requires overriding to match FocusFlow's design system

## Consequences

- All analytics charts use Recharts
- Data is aggregated server-side (or via domain functions) before being passed to charts
- Charts include ARIA labels and accessible color choices (not color-only encoding)
