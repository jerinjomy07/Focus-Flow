# ADR-001: Next.js App Router over Pages Router

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

FocusFlow requires a full-stack web framework supporting both server-rendered pages and API endpoints. The two primary options within the Next.js ecosystem are the legacy Pages Router and the newer App Router (introduced in Next.js 13, stabilized in Next.js 14/15).

## Decision

Use **Next.js 15 with App Router** and React Server Components.

## Rationale

| Factor | Pages Router | App Router |
|---|---|---|
| Data fetching | Client or getServerSideProps | Server Components (no waterfall) |
| API routes | `pages/api/` | Route Handlers in `app/api/` |
| Bundle size | Client receives all component code | Server Components stay on server |
| Layouts | Manual nesting required | Nested layouts are first-class |
| Caching | Manual | Built-in segment caching |
| React version | React 18 compatible | React 18/19 RSC support |
| Vercel alignment | Fully supported | Preferred; best feature alignment |

**Key benefits for FocusFlow:**
- Analytics and dashboard pages are data-heavy → RSC reduces client bundle significantly
- Nested layouts support authenticated shell + per-page layout without boilerplate
- Route Handlers provide clean, co-located API alongside pages

## Trade-offs Accepted

- RSC mental model is stricter — need discipline to avoid `use client` creep
- Some third-party libraries have RSC compatibility issues (evaluated case-by-case)
- More complex than Pages Router for simple use cases

## Mitigation

- Establish clear rule: RSC for data fetching and layout; `use client` only for interactive components
- Vet library RSC compatibility before adoption
- Use documented `use client` boundaries

## Consequences

All application routing and API development follows App Router conventions. Pages Router is not used.
