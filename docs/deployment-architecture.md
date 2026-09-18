# FocusFlow — Deployment Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Hosting Architecture & Topology

FocusFlow is architected for automated, cloud-native deployment using **Vercel** for frontend and serverless compute, alongside a managed **PostgreSQL** provider (e.g. Neon or Supabase) with built-in connection pooling.

```
                  ┌─────────────────────────────────────┐
                  │          DNS / Cloudflare           │
                  └──────────────────┬──────────────────┘
                                     │ HTTPS
                  ┌──────────────────▼──────────────────┐
                  │          Vercel Edge Network        │
                  │   - Global CDN Cache                │
                  │   - Static Asset Serving            │
                  │   - Edge Middleware (Auth Guard)    │
                  └──────────┬──────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
  [Server Components / SSR]         [API Route Handlers]
  (Node.js Serverless Runtime)      (Node.js Serverless Runtime)
            │                                 │
            └────────────────┬────────────────┘
                             │ Prisma Client (Pooled)
                  ┌──────────▼──────────────────────────┐
                  │       PgBouncer / Connection Pool   │
                  └──────────────────┬──────────────────┘
                                     │ Direct Connections
                  ┌──────────────────▼──────────────────┐
                  │        Managed PostgreSQL           │
                  │          (Neon Database)            │
                  └─────────────────────────────────────┘
```

---

## 2. Environment Lifecycle & Separation

FocusFlow maintains three strictly isolated environments:

| Environment | Purpose | URL / Host | Database Instance |
|---|---|---|---|
| **Development** | Local engineering and automated testing | `http://localhost:3000` | Local PostgreSQL Docker container or isolated dev branch |
| **Preview** | Ephemeral feature branch validation per PR | `https://focusflow-git-<branch>.vercel.app` | Isolated preview database branch (e.g. Neon branching) |
| **Production** | Live SaaS environment for real users | `https://focusflow.app` | Dedicated production PostgreSQL with automated backups |

---

## 3. Continuous Delivery & Build Pipeline

Every deployment follows a deterministic, automated sequence in CI/CD:

```
[Git Push to 'main']
         │
         ▼
1. Quality Gate (GitHub Actions)
   ├── npm run type-check (tsc --noEmit)
   ├── npm run lint (ESLint strict)
   ├── npm run test:unit (Vitest)
   └── npm run test:integration (Vitest + Test DB)
         │
         ▼ (Quality Gate Passed)
2. Database Schema Migration
   └── npx prisma migrate deploy (Executes against Production DB)
         │
         ▼ (Migrations Applied Cleanly)
3. Vercel Build & Artifact Packaging
   ├── npx prisma generate (Builds typed Prisma Client)
   ├── next build (Static compilation & RSC optimization)
   └── Automated health check validation on deployment preview
         │
         ▼ (All Probes 200 OK)
4. Traffic Promotion
   └── Immediate atomic traffic cutover to new deployment
```

---

## 4. Environment Variables Specification

All sensitive secrets are managed exclusively through Vercel Environment Variables and GitHub Actions Secrets. They are never committed to Git.

### 4.1 Required Production Variables

| Variable Name | Exposure | Required For | Description |
|---|---|---|---|
| `DATABASE_URL` | Server Only | Prisma ORM | Connection string with pooled PgBouncer (`?sslmode=require&pgbouncer=true`) |
| `DIRECT_URL` | Server Only | Prisma Migrate | Direct non-pooled PostgreSQL URL for schema migrations and DDL commands |
| `AUTH_SECRET` | Server Only | Auth.js v5 | 256-bit cryptographically random secret used to sign session tokens |
| `AUTH_URL` | Server Only | Auth.js v5 | Canonical application URL (e.g. `https://focusflow.app`) |
| `SENTRY_DSN` | Server & Client | Error Logging | Sentry project data source name |
| `NEXT_PUBLIC_APP_URL` | Client Accessible | Metadata / Links | Public application base URL |
| `NEXT_PUBLIC_APP_VERSION`| Client Accessible | Telemetry / Footer| Semantic release version string |

---

## 5. Database Migration Safety & Zero-Downtime Rules

To eliminate deployment downtime and prevent service interruptions:

1. **Two-Phase Schema Migrations:**
   - Destructive operations (dropping columns, renaming fields) must be executed across two distinct releases:
     - *Phase A:* Add new column; make old column nullable; deploy code that reads new/writes both.
     - *Phase B (Subsequent Release):* Drop deprecated column after verification.
2. **Pre-Deployment Execution:**
   - Schema migrations (`prisma migrate deploy`) always execute **before** new application code receives traffic.
   - If a migration fails, the build terminates immediately, leaving existing production serverless instances running without disturbance.

---

## 6. Rollback & Disaster Recovery Strategy

### 6.1 Application Rollback (Instant)
- Vercel deployments are immutable and instant. If a critical regression bypasses automated testing, the operations team triggers an instant rollback to the previous deployment artifact in the Vercel dashboard with **zero re-build time (< 5 seconds)**.

### 6.2 Database Disaster Recovery
- **Continuous Backups:** Managed PostgreSQL (Neon) maintains point-in-time recovery (PITR) with a minimum 7-day retention window.
- **Transactional Migrations:** Prisma wraps individual schema migrations within database transactions, automatically rolling back uncommitted DDL changes upon syntax errors.

---

## 7. Security Hardening at the Edge

1. **DDoS Protection:** Vercel Edge Network provides automated L3/L4 volumetric DDoS mitigation.
2. **TLS 1.3:** All connections enforce modern TLS encryption with automatic SSL certificate renewal.
3. **HTTP Security Headers:** Injected globally via `next.config.ts` (HSTS, CSP, Frame-Options).
