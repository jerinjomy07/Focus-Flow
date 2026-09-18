# ADR-002: Auth.js v5 over Clerk / Supabase Auth

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

FocusFlow requires secure, production-grade user authentication. Several mature options exist:

1. **Auth.js v5 (NextAuth)** — open-source auth library for Next.js
2. **Clerk** — managed auth SaaS with embeddable UI components
3. **Supabase Auth** — auth bundled with Supabase as a platform
4. **Custom implementation** — hand-rolled authentication

## Decision

Use **Auth.js v5** with the Prisma adapter.

## Rationale

### Why Auth.js over Clerk

| Factor | Clerk | Auth.js |
|---|---|---|
| Cost | Paid beyond 10,000 MAU | Free / open source |
| Vendor lock-in | High (Clerk-specific UI + API) | Low (standard sessions) |
| Data ownership | User data held by Clerk | User data in our Prisma DB |
| Customization | Limited by Clerk's API | Full control |
| OAuth providers | Excellent | Excellent |
| Next.js support | Strong | Native (it's built for Next.js) |

Clerk's pricing is not appropriate for a pre-revenue product, and the vendor lock-in on user data is a strategic risk.

### Why Auth.js over Supabase Auth

Supabase Auth is tightly coupled to the Supabase platform. Using it would:
- Require Supabase as the database provider (removing the ability to use Neon, Railway, etc.)
- Introduce a second client SDK
- Couple auth to a specific infrastructure vendor

FocusFlow uses Prisma against PostgreSQL and wants provider portability.

### Why not custom authentication

Custom authentication carries significant security risk. Password hashing, CSRF, session management, and token rotation all require careful implementation. Auth.js is security-reviewed and solves these problems correctly.

## Trade-offs Accepted

- Auth.js v5 is still maturing (some API instability during early v5 releases)
- Initial setup is more involved than Clerk's copy-paste approach
- OAuth requires configuring provider apps (Google, GitHub) manually

## Mitigation

- Pin Auth.js to a specific minor version
- Read the v5 migration guide thoroughly before implementation
- Test auth flows in CI (integration tests)

## Consequences

- User, Account, Session, VerificationToken tables managed by Auth.js/Prisma adapter
- Session management uses secure httpOnly cookies
- OAuth can be added later by registering additional providers with no architectural change
