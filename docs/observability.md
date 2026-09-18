# FocusFlow — Observability Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Observability Strategy & Core Principles

FocusFlow operates on a lightweight, production-grade observability architecture designed for a modern SaaS platform. It avoids over-engineering heavy distributed tracing or complex infrastructure agents while providing complete diagnostic clarity across four pillars:

1. **Structured Logging:** Machine-readable JSON logs with request correlation and PII redaction.
2. **Exception Tracking:** Immediate crash capture and stack-trace aggregation via **Sentry**.
3. **Application Health:** Lightweight uptime and dependency probes (`/api/health`).
4. **Performance Monitoring:** Automated Core Web Vitals tracking and database slow-query alerts.

---

## 2. Structured Logging Pipeline

### 2.1 Logger Configuration
- **Library:** **Pino** (high-throughput, zero-overhead JSON logger).
- **Format:**
  - *Development:* Pretty-printed colorized output via `pino-pretty`.
  - *Production:* Single-line structured JSON output streamed to `stdout` (captured by Vercel / log aggregators).

### 2.2 Standard Log Schema
Every server-side log record includes uniform diagnostic metadata:

```json
{
  "level": 30,
  "time": 1790000000000,
  "pid": 12,
  "hostname": "vercel-lambda-1",
  "reqId": "req_01h9a8b...",
  "userId": "usr_01h8c7d...",
  "module": "focus-sessions",
  "action": "session_completed",
  "durationMs": 1500,
  "msg": "Focus session completed successfully"
}
```

### 2.3 Log Levels & Policy

| Level | When Used | Example |
|---|---|---|
| `fatal` | Process-halting catastrophic errors | Database connection pool permanently exhausted |
| `error` | Unhandled exceptions, failed DB writes, 500s | Sentry-captured crash in analytics rollup |
| `warn` | Recoverable anomalies, rate-limit warnings, clock skews | User OS clock skewed backwards during active timer |
| `info` | Semantic domain milestones, auth events | User registered, focus session completed, project created |
| `debug` | Verbose diagnostic details (disabled in production) | Cache hits/misses, detailed request parameter dumps |

### 2.4 PII Redaction & Data Protection
Logs automatically filter out sensitive user credentials:
```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['password', 'passwordHash', 'token', 'email', 'cookie', 'authorization'],
    censor: '[REDACTED]',
  },
});
```

---

## 3. Exception Tracking & Error Reporting (Sentry)

### 3.1 Client & Server Sentry Integration
- **Package:** `@sentry/nextjs`
- **Client Configuration:** Initializes in `instrumentation.ts` / `sentry.client.config.ts`. Automatically tracks unhandled React component exceptions and rejected promises.
- **Server Configuration:** Catches unhandled Route Handler exceptions.

### 3.2 Error Filtering & Scrubbing
- **Before-Send Hook:** Strips all search parameters and request bodies from error payloads to prevent accidental leakage of personal notes or task titles to third-party dashboards.
- **Ignored Errors:** Known benign client errors (e.g. `ResizeObserver loop limit exceeded`, user aborted fetch) are discarded before transmission.

---

## 4. Request Correlation & Context Propagation

Every incoming HTTP request is assigned a unique, collision-resistant correlation identifier (`X-Request-Id`):
1. Next.js Edge Middleware checks for an existing `X-Request-Id` header (from reverse proxies or CDNs).
2. If absent, it generates a `cuid()` and attaches it to the request and response headers.
3. All internal loggers and Sentry transactions inherit this `reqId`, enabling instant end-to-end tracing from client error modal to server log entry.

---

## 5. Health Check & Liveness Probes

### Endpoint: `GET /api/health`
Used by uptime monitors (Better Uptime, Pingdom, Vercel Health Checks) to verify system integrity:

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();

  try {
    // Verify PostgreSQL connection liveness
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    }, { status: 503 });
  }
}
```

---

## 6. Database & Query Performance Monitoring

1. **Slow Query Detection:** Prisma Client event hooks log a warning for any query exceeding **250ms**:
   ```typescript
   prisma.$on('query', (e) => {
     if (e.duration >= 250) {
       logger.warn({
         event: 'slow_query',
         query: e.query,
         durationMs: e.duration,
       }, `Slow database query detected (${e.duration}ms)`);
     }
   });
   ```
2. **Connection Pooling Metrics:** Managed PostgreSQL (Neon/PgBouncer) tracks active pool connections and throttles spikes before database exhaustion occurs.

---

## 7. Frontend Performance & Core Web Vitals

- **Vercel Speed Insights:** Tracks real-user Core Web Vitals:
  - **LCP (Largest Contentful Paint):** Target $\le 2.5\text{s}$
  - **INP (Interaction to Next Paint):** Target $\le 200\text{ms}$
  - **CLS (Cumulative Layout Shift):** Target $\le 0.1$
- **Timer Component Budget:** The active timer display component must maintain $\ge 55\text{fps}$ during active animation with zero memory leaks over a continuous 2-hour session.
