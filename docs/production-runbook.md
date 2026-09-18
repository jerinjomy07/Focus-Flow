# FocusFlow — Production Operational Runbook

**Version:** 1.0.0 (Phase 12 — Production Deployment)  
**Date:** 2026-09-17  
**Status:** Approved Operational Runbook  
**Target Environment:** Vercel (Edge/Serverless) + Neon (PostgreSQL)

---

## 1. Production Release Checklist

Before triggering a production release to `main`:

- [ ] **Type Check & Lint:** `npm run type-check` and `npm run lint` pass with 0 errors.
- [ ] **Test Suite:** `npm test` executes cleanly (100% pass rate across all 43+ test suites).
- [ ] **Build Validation:** `npm run build` succeeds locally or in CI preview without warnings.
- [ ] **Migration Safety:** Any new Prisma migration is purely additive (no unannounced column drops or breaking renames).
- [ ] **Environment Parity:** Any new environment variables added to `.env.example` are populated in the Vercel Production Dashboard.
- [ ] **Database Backup:** Confirm Neon point-in-time recovery (PITR) is active; trigger a manual snapshot if the release contains structural DDL.

---

## 2. Deployment Execution

### 2.1 Automated CI/CD Release (Recommended)
1. Merge the approved pull request into the `main` branch.
2. The GitHub Actions workflow (`.github/workflows/ci.yml`) automatically triggers:
   - Validates code formatting, linter, TypeScript types, and test suites.
   - Executes database migrations: `npm run db:migrate:deploy`.
   - Vercel detects the push, initiates `prisma generate && next build`, and stages the release.
3. Upon green build status, Vercel executes an atomic instant traffic cutover to the new deployment.

### 2.2 Manual Emergency Release (Vercel CLI Fallback)
If GitHub Actions CI/CD is degraded:
```bash
# 1. Authenticate with Vercel
npx vercel login

# 2. Run migrations directly against Direct URL
DIRECT_URL="postgresql://user:pass@host/focusflow?sslmode=require" npx prisma migrate deploy

# 3. Build and deploy to production
npx vercel --prod
```

---

## 3. Post-Deployment Verification (Smoke Tests)

Execute the production smoke verification immediately following deployment:

```bash
# 1. Health Probe
curl -i https://focusflow.app/api/health
# Verify: HTTP 200 OK, "status": "healthy", "database": {"status": "connected"}

# 2. Security Headers
curl -s -D - https://focusflow.app/ -o /dev/null | grep -iE '(strict-transport-security|x-content-type-options|x-frame-options|content-security-policy)'
# Verify: All headers present with production values

# 3. User Authentication Flow
# Verify: Login at https://focusflow.app/login succeeds and issues secure authjs.session-token cookie

# 4. Timer & Session Lifecycle
# Verify: Starting a 25-minute Pomodoro updates the active task and completes without 429/500 errors
```

---

## 4. Rollback Procedures

### 4.1 Instant Application Rollback (Vercel)
If a critical frontend or serverless regression occurs:
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Navigate to **Deployments**.
3. Locate the previous known-healthy deployment.
4. Click the three dots (`...`) menu and select **Instant Rollback** (or **Promote to Production**).
5. **Execution Time:** Immediate (< 5 seconds, zero build time).
6. Verify recovery via `GET https://focusflow.app/api/health`.

### 4.2 Database Migration Rollback Strategy
Because Prisma schema migrations are forward-only, rolling back schema changes must be approached systematically:

- **Scenario A: Purely Additive Migrations (New table or optional column)**
  - *Action:* No immediate database rollback required. Code rollback to the previous application version will simply ignore the new table or column.
  - *Follow-up:* Submit a new migration in a subsequent PR if the schema additions should be cleaned up.

- **Scenario B: Failed Migration During Deployment**
  - If `prisma migrate deploy` failed mid-execution, Prisma marks the migration as failed in `_prisma_migrations`.
  - Resolve the issue:
    ```bash
    # Check migration status
    npx prisma migrate status

    # Mark migration as rolled back if applied partially
    npx prisma migrate resolve --rolled-back <migration_name>
    ```

- **Scenario C: Catastrophic Data Anomaly**
  - Use Neon Point-In-Time Recovery (PITR) to restore the database to a timestamp immediately prior to deployment (see `docs/database-operations.md`).

---

## 5. Secret Rotation Procedures

### 5.1 Rotating `AUTH_SECRET`
Rotating `AUTH_SECRET` invalidates all existing user session JWTs, requiring users to log in again.
1. Generate a new 256-bit cryptographically random hex string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In Vercel Project Settings > **Environment Variables**, update `AUTH_SECRET`.
3. Redeploy the latest production deployment (or trigger **Redeploy** from the Vercel dashboard).
4. Verify by logging in with fresh credentials.

### 5.2 Rotating Database Credentials (`DATABASE_URL` & `DIRECT_URL`)
1. In the Neon Console, navigate to **Roles & Databases**.
2. Create a secondary role `focusflow_app_v2` with appropriate permissions, or generate a new password for the existing role.
3. Update `DATABASE_URL` (with PgBouncer query params) and `DIRECT_URL` in Vercel Environment Variables.
4. Redeploy to apply new connection parameters.
5. In Neon Console, verify active connections migrate to the new credential and terminate the deprecated role.

### 5.3 Rotating Upstash Redis Credentials
1. In the Upstash Console, generate a secondary REST token.
2. Update `UPSTASH_REDIS_REST_TOKEN` in Vercel Environment Variables.
3. Trigger a Vercel redeployment.
4. Revoke the old token in Upstash Console once traffic cuts over.

---

## 6. Incident Response Playbooks

### 6.1 Database Connection Pool Exhaustion (HTTP 503 / Prisma Timeout)
- **Symptoms:** `GET /api/health` returns HTTP 503; logs show `Timed out fetching a connection from the pool`.
- **Diagnostic Steps:**
  1. Inspect Neon Console > **Monitoring** for active connection count and compute CPU utilization.
  2. Verify that `DATABASE_URL` in Vercel includes `?sslmode=require&pgbouncer=true`. If connecting directly to port 5432 without PgBouncer, serverless scale-outs will rapidly exceed PostgreSQL `max_connections`.
- **Mitigation:**
  1. Ensure pooled endpoint (`-pooler.neon.tech`) is active in Vercel environment variables.
  2. Increase connection limit in Neon compute settings if traffic exceeds standard allocation.
  3. Restart Neon compute node if connections are hung in zombie transaction states.

### 6.2 Elevated Rate of 500 Errors
- **Symptoms:** Vercel monitoring or Sentry alerts spike in 500 responses.
- **Diagnostic Steps:**
  1. Inspect structured JSON logs in Vercel Runtime Logs: filter by `level: "error"`.
  2. Identify specific route handler throwing the exception.
- **Mitigation:**
  1. If caused by a bad code release: trigger **Instant Rollback** in Vercel.
  2. If caused by downstream database issues: check `/api/health` and Neon status.

### 6.3 Rate Limit Abuse or Volumetric Attacks
- **Symptoms:** Specific IP addresses or user agents flooding `/api/auth/register` or `/api/focus-sessions`.
- **Diagnostic Steps:**
  1. Inspect Vercel Firewall / Access Logs to identify attacking IP ranges or anomalies.
- **Mitigation:**
  1. If distributed Redis rate limiter is active, confirm it is issuing HTTP 429 `Too Many Requests`.
  2. In Vercel Project Settings > **Security / Firewall**, add custom firewall rules to block abusive IP addresses, ASN ranges, or countries.
