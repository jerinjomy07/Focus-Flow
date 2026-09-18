# FocusFlow — Production Deployment Guide

**Version:** 1.0.0 (Phase 12 — Production Deployment)  
**Date:** 2026-09-17  
**Status:** Approved Operational Specification  
**Target Architecture:** Vercel (Edge & Serverless Compute) + Neon (Managed Serverless PostgreSQL)

---

## 1. Architecture Overview

FocusFlow is deployed as a high-performance, serverless modern web application:
- **Application & Edge Layer:** Hosted on **Vercel**, leveraging Edge Middleware for authentication guarding and rate limiting, React Server Components (RSC) for zero-bundle data fetching, and Node.js serverless functions for API route handlers.
- **Persistence Layer:** Hosted on **Managed PostgreSQL** via **Neon**, utilizing integrated PgBouncer connection pooling to handle transient serverless connection bursts without exhausting database capacity.
- **Cache & Distributed State (Optional):** **Upstash Redis** (or Vercel KV) via REST API for cross-instance distributed rate limiting.

```
                      ┌──────────────────────────────────────┐
                      │          DNS / Custom Domain         │
                      │          (https://focusflow.app)     │
                      └──────────────────┬───────────────────┘
                                         │ HTTPS / TLS 1.3
                      ┌──────────────────▼───────────────────┐
                      │          Vercel Edge Network         │
                      │  - Global CDN & Static Assets        │
                      │  - Edge Middleware (Auth Guard / RL) │
                      │  - Automatic SSL & DDoS Mitigation   │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
       [Server Components / SSR]                       [API Route Handlers]
       (Node.js Serverless)                            (Node.js Serverless)
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │ Prisma Client (Pooled)
                      ┌──────────────────▼───────────────────┐
                      │          Neon PgBouncer Pool         │
                      │       (?sslmode=require&pgbouncer=true)│
                      └──────────────────┬───────────────────┘
                                         │ Direct Connection
                      ┌──────────────────▼───────────────────┐
                      │        Managed PostgreSQL 16         │
                      │         (Neon Compute Node)          │
                      └──────────────────────────────────────┘
```

---

## 2. Environment Taxonomy

FocusFlow strictly isolates runtime environments to prevent data cross-contamination and ensure deterministic release verification:

| Environment | Host / URL | Purpose | Database Strategy |
|---|---|---|---|
| **Development** | `http://localhost:3000` | Local developer workstation | Local Docker container or embedded PostgreSQL instance |
| **Preview** | `https://focusflow-git-<branch>.vercel.app` | Ephemeral pull request validation | Neon copy-on-write database branch (isolated schema/data) |
| **Production** | `https://focusflow.app` | Live customer traffic | Dedicated primary Neon database with automated PITR backups |

---

## 3. Managed Database Provisioning (Neon)

### 3.1 Project Creation
1. Log in to the [Neon Console](https://console.neon.tech).
2. Click **Create Project**.
3. Configure the database:
   - **Project Name:** `focusflow-production`
   - **Postgres Version:** `16` (or latest stable supported by Prisma)
   - **Region:** Select the region closest to your Vercel deployment region (e.g., `us-east-1` / `iad1` to minimize connection latency).
   - **Compute Size:** Start with Neon's standard auto-scaling tier (minimum 0.25 vCPU, scale up on demand).

### 3.2 Obtaining Connection Strings
Neon provides two connection strings in the project dashboard:
1. **Pooled Connection String (`DATABASE_URL`):**
   - Utilizes PgBouncer on port 5432 / 6432.
   - Includes query parameters: `?sslmode=require&pgbouncer=true`.
   - Example:
     ```text
     postgresql://focusflow_owner:SECRET_PASSWORD@ep-delicate-pooler-123456.us-east-1.aws.neon.tech/focusflow?sslmode=require&pgbouncer=true
     ```
2. **Direct Connection String (`DIRECT_URL`):**
   - Non-pooled direct connection to the Postgres compute node.
   - Required for executing DDL operations via `prisma migrate deploy`.
   - Example:
     ```text
     postgresql://focusflow_owner:SECRET_PASSWORD@ep-delicate-123456.us-east-1.aws.neon.tech/focusflow?sslmode=require
     ```

---

## 4. Vercel Project Configuration

### 4.1 Project Import & Build Settings
1. Navigate to the [Vercel Dashboard](https://vercel.com) and click **Add New > Project**.
2. Connect your Git repository (GitHub / GitLab).
3. Configure project settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `focusflow-app` (since the Next.js app resides in the subfolder)
   - **Build Command:** `prisma generate && next build` (defined in `vercel.json` and package scripts)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
   - **Node.js Version:** `20.x` or `22.x`

### 4.2 Environment Variables Setup
Configure the following environment variables in **Project Settings > Environment Variables**:

| Variable | Target Environment | Secret? | Description |
|---|---|---|---|
| `DATABASE_URL` | Production & Preview | Yes | Pooled connection string with `?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Production & Preview | Yes | Direct non-pooled connection string for migrations |
| `AUTH_SECRET` | Production & Preview | Yes | 256-bit cryptographically random hex secret |
| `AUTH_URL` | Production | No | Canonical app URL: `https://focusflow.app` |
| `NEXT_PUBLIC_APP_URL` | Production | No | `https://focusflow.app` |
| `NEXT_PUBLIC_APP_VERSION`| All | No | Semantic version, e.g. `1.0.0` |
| `UPSTASH_REDIS_REST_URL` | Production (Optional) | Yes | Upstash Redis REST URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN`| Production (Optional) | Yes | Upstash Redis REST bearer token |
| `LOG_LEVEL` | Production | No | `info` (or `warn`) |

> [!TIP]
> To generate a secure `AUTH_SECRET`, run:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. Deployment Lifecycle & Migration Sequence

FocusFlow maintains strict pre-deploy migration discipline to ensure serverless route handlers never interact with an unmigrated database schema.

### 5.1 Automated GitHub Actions Pipeline
The repository includes `.github/workflows/ci.yml` which executes:
1. **Type Checking:** `npm run type-check` (`tsc --noEmit`)
2. **Strict Linting:** `npm run lint` (`eslint`)
3. **Automated Testing:** `npm test` (all unit and integration tests across 43+ suites)
4. **Production Build:** `npm run build` (`prisma generate && next build`)
5. **Dependency Audit:** `npm audit` (monitoring production runtime dependencies)

### 5.2 Database Migration Protocol
Database migrations are applied using Prisma's production command:
```bash
npm run db:migrate:deploy
```
*(Equivalent to `npx prisma migrate deploy`)*

**Execution Order:**
1. CI/CD initiates production release.
2. Migrations execute against `DIRECT_URL`.
3. If migration succeeds, Vercel initiates the build and deployment.
4. If migration fails, deployment halts immediately; existing production instances remain untouched.

---

## 6. Custom Domain & DNS Configuration

1. In the Vercel project, go to **Settings > Domains**.
2. Add your production domain: `focusflow.app` and `www.focusflow.app`.
3. Configure your DNS provider (e.g., Cloudflare, Route53, Namecheap):
   - **Root domain (`focusflow.app`):**
     - Type: `A`
     - Name: `@`
     - Value: `76.76.21.21` (Vercel IP)
   - **Subdomain (`www.focusflow.app`):**
     - Type: `CNAME`
     - Name: `www`
     - Value: `cname.vercel-dns.com.`
4. Vercel automatically issues and renews a Let's Encrypt TLS certificate. Once verified, configure `www.focusflow.app` to redirect to `focusflow.app` (or vice-versa).

---

## 7. Post-Deployment Verification Checklist

Immediately following deployment, run the automated verification checks:

1. **Liveness & Readiness Probe:**
   ```bash
   curl -i https://focusflow.app/api/health
   ```
   *Expected:* HTTP `200 OK`, `database.status: "connected"`, `status: "healthy"`.
2. **Security Headers Verification:**
   ```bash
   curl -I https://focusflow.app/
   ```
   *Expected Headers:*
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy: default-src 'self'; ...`
3. **Core Workflow Verification:**
   - Execute user login and session cookie persistence.
   - Start and complete a 25-minute Pomodoro focus session.
   - Verify dashboard and session history reflection.
