# FocusFlow — Database Operations & Migration Architecture

**Version:** 1.0.0 (Phase 12 — Production Deployment)  
**Date:** 2026-09-17  
**Status:** Approved Operational Specification  
**DBMS:** PostgreSQL 16 (Managed via Neon) + Prisma ORM 6

---

## 1. Production Migration Strategy

FocusFlow enforces forward-only, non-destructive schema migrations to maintain continuous uptime during deployments.

### 1.1 Forward-Only Additive Migrations
All schema modifications must adhere to backward compatibility:
- Columns added to existing tables must either be **optional (`?`)** or specify a safe **default value**.
- Tables and indexes may be added freely.
- Column types may only be expanded if the conversion is lossless and does not require an exclusive table lock that blocks reads/writes.
- Columns, tables, or constraints must **never** be dropped in the same release that introduces application code that stops using them.

### 1.2 Two-Phase Migration Pattern for Breaking Changes
When field renaming or column removal is mandatory, execute across two distinct sequential releases:

```
┌─────────────────────────────────────────────────────────────┐
│ RELEASE N: Expand                                           │
│ 1. Add new column `new_field` (nullable).                   │
│ 2. Application writes to both `old_field` and `new_field`.  │
│ 3. Application reads from `new_field` (falling back to old).│
└──────────────────────────────┬──────────────────────────────┘
                               │ Backfill existing rows
┌──────────────────────────────▼──────────────────────────────┐
│ RELEASE N+1: Contract                                       │
│ 1. Application code now only touches `new_field`.           │
│ 2. Drop `old_field` in migration N+1.                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Execution via CI/CD
In automated pipelines, schema migrations are applied using:
```bash
npm run db:migrate:deploy
```
*(Executes `prisma migrate deploy` against `DIRECT_URL`)*

Prisma records every applied migration in the `_prisma_migrations` metadata table with SHA256 checksums, execution timestamps, and success/failure statuses. Migrations run in a single transaction per migration file where supported by PostgreSQL.

---

## 2. Serverless Connection Pooling (PgBouncer & Neon)

### 2.1 Connection Topology
Serverless architectures instantiate and tear down ephemeral worker containers rapidly. If every serverless container opened a direct connection to PostgreSQL, standard connection thresholds (typically 100–300 max connections) would be exhausted within seconds during traffic spikes.

FocusFlow mitigates this using a dual-endpoint design:

1. **`DATABASE_URL` (Pooled Runtime Connections):**
   - Directs traffic to Neon's built-in PgBouncer pooler running in transaction mode.
   - Appended with `?sslmode=require&pgbouncer=true`.
   - Used by Prisma Client for all application queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, raw queries).
2. **`DIRECT_URL` (DDL & Schema Management):**
   - Direct connection to the primary PostgreSQL compute node on port 5432.
   - Bypasses PgBouncer (which does not support Prisma's schema advisory locks or shadow database inspection).
   - Used exclusively by `prisma migrate deploy` and administrative scripts.

### 2.2 Prisma Client Singleton Reuse
In `src/lib/db/client.ts`, the Prisma client is cached on the Node.js global object (`globalThis.prisma`) across warm serverless invocations:
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Cache on global across invocations in development and serverless environments
globalForPrisma.prisma = prisma;
```
This guarantees that a single serverless container does not spawn redundant client instances or connection pools over its lifetime.

---

## 3. Backup, Disaster Recovery & PITR

### 3.1 Point-in-Time Recovery (PITR)
Neon provides continuous write-ahead log (WAL) archiving and instant branching:
- **Retention Window:** 7 days (or 30 days depending on plan tier).
- **Recovery Granularity:** Can restore database state to any specific second within the retention window.
- **Recovery Point Objective (RPO):** < 1 minute.
- **Recovery Time Objective (RTO):** < 5 minutes (instant copy-on-write branch creation).

### 3.2 Pre-Migration Manual Snapshot Protocol
Prior to applying major migrations or running data-backfill scripts:
1. In the Neon Console, navigate to the target branch (e.g., `main`).
2. Click **Create Branch**.
3. Name the snapshot: `snapshot-pre-release-YYYYMMDD-HHMM`.
4. If a catastrophic issue occurs during the deployment:
   - Promote the snapshot branch to primary, OR
   - Export data from the snapshot branch to remediate corrupted rows.

### 3.3 Logical Backups (`pg_dump`)
For off-site disaster recovery compliance, run periodic logical dumps:
```bash
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges -f "backup-$(date +%Y%m%d).dump"
```

---

## 4. Performance Monitoring & Index Health

### 4.1 Production Indexes
Phase 11 and earlier phases established optimized composite indexes for all high-frequency query patterns:
- `FocusSession`: `(userId, status, startedAt DESC)` for active session lookup and session history pagination.
- `Task`: `(userId, status, priority, orderIndex)` for task list filtering and reordering.
- `Notification`: `(userId, isRead, createdAt DESC)` for unread notification count and feed retrieval.
- `DailyMetric`: `(userId, date)` unique composite index for upserting analytics metrics.

### 4.2 Query Performance Analysis (`pg_stat_statements`)
To identify slow or unindexed queries in production:
```sql
SELECT
  substring(query, 1, 80) AS short_query,
  calls,
  total_exec_time / calls AS avg_time_ms,
  max_exec_time AS max_time_ms,
  rows / calls AS avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### 4.3 Database Vacuum & Maintenance
PostgreSQL auto-vacuuming is enabled by default in Neon. No manual `VACUUM FULL` should be executed during peak operational hours as it acquires an exclusive table lock.
