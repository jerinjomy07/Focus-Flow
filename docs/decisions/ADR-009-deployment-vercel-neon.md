# ADR-009: Vercel & Managed PostgreSQL (Neon) for Cloud Deployment

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team  

---

## 1. Context

FocusFlow requires a scalable, low-maintenance deployment target for its Next.js application, serverless API routes, and PostgreSQL persistence layer. We evaluated three architectural deployment targets:

1. **Vercel + Managed Serverless PostgreSQL (Neon)**
2. **Docker / AWS ECS / Fargate + RDS PostgreSQL**
3. **PaaS (Railway / Render / Fly.io)**

---

## 2. Decision

Deploy FocusFlow on **Vercel** paired with **Neon Managed PostgreSQL** (with pooled connections via PgBouncer).

---

## 3. Rationale & Tradeoff Analysis

### Why Vercel for Application Compute
- **Native Next.js Alignment:** Vercel is the creator and maintainer of Next.js. Features such as React Server Components (RSC), App Router streaming, Edge Middleware, and automatic bundle optimization work seamlessly with zero bespoke infrastructure configuration.
- **Preview Deployments:** Every pull request automatically generates a live, isolated preview environment, dramatically increasing QA velocity and visual verification.
- **Instant Rollback:** Production deployments are immutable; any detected regression can be rolled back to the previous stable release artifact within seconds without a rebuild.
- **Zero Ops Overhead:** No Kubernetes cluster management, container registry orchestration, or OS patch maintenance.

### Why Neon for PostgreSQL Persistence
- **Built-in Serverless Connection Pooling (PgBouncer):** Serverless Route Handlers create ephemeral connections that can rapidly exhaust traditional PostgreSQL connection pools. Neon provides integrated connection pooling out of the box.
- **Database Branching:** Neon allows instant copy-on-write database branches for PR preview environments, enabling migrations to be tested against realistic data schemas without touching production.
- **High Availability & Automated Backups:** Automated point-in-time recovery (PITR) ensures data integrity.

---

## 4. Alternatives Considered & Rejected

- **Self-Managed AWS ECS / Kubernetes:** Excessive operational complexity, high initial maintenance cost, and slower engineering iteration for a single-developer or early-stage team.
- **Railway / Render:** Viable options, but lack the deep integration with Next.js App Router performance optimizations and granular Edge network capabilities provided natively by Vercel.

---

## 5. Consequences

- Production builds use `next build` executed directly by Vercel CI.
- Schema migrations run as a pre-deploy phase via `npx prisma migrate deploy`.
- Connection pooling URLs are supplied via `DATABASE_URL`, with non-pooled direct URLs supplied via `DIRECT_URL` for migration scripts.
