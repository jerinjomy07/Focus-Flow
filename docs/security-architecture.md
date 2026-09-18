# FocusFlow — Security Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Security Baseline & Philosophy

FocusFlow processes personal productivity logs, daily habit trackers, project structures, and private notes. The security architecture adheres to **Zero Trust Client** and **Defense-in-Depth** principles:

> **No client request is ever trusted. Every API invocation undergoes cryptographic authentication verification, strict schema validation, and server-side tenant authorization before reaching the domain or database.**

---

## 2. Authentication & Credential Hardening

### 2.1 Password Hashing & Storage
- **Algorithm:** **Bcrypt** with a work cost factor of 12 ($2b$12$) or **Argon2id** (memory cost 64MB, 3 iterations).
- Plaintext passwords are never logged, cached, transmitted in responses, or held in memory beyond the scope of the hashing routine.
- Password complexity requirements enforced via Zod:
  - Minimum length: 8 characters (maximum: 128 characters to prevent DoS via CPU-bound hashing).
  - Must contain at least one uppercase letter, one lowercase letter, and one number.

### 2.2 Session Security
- **Session Strategy:** Database-backed sessions managed via Auth.js v5 and Prisma adapter.
- **Session Tokens:** Cryptographically random 256-bit entropy tokens stored in database table `Session`.
- **Cookie Security Flags:**
  - `HttpOnly: true` — Blocks client-side JavaScript access via `document.cookie` (mitigates session hijacking via XSS).
  - `Secure: true` — Enforced in production; cookie is transmitted strictly over HTTPS TLS 1.3.
  - `SameSite: Lax` — Protects against Cross-Site Request Forgery (CSRF) on cross-origin top-level navigations while enabling normal inbound links.
  - `Path: /`
  - `Max-Age: 2592000` (30 days with sliding session extension upon active requests).

---

## 3. Server-Side Authorization & Tenant Isolation

### 3.1 Authentication vs. Authorization Separation
* **Authentication:** Answers *"Who is making this request?"* Validated at the edge/middleware or entry of the Route Handler using `await auth()`.
* **Authorization:** Answers *"Is this user permitted to inspect, modify, or delete this specific resource?"* Validated on every single database query.

### 3.2 Anti-Enumeration Rule (404 instead of 403)
When a user attempts to access a resource (e.g. `GET /api/tasks/tsk_999`) that exists in the database but belongs to a different tenant:
- **Prohibited Behavior:** Returning `403 Forbidden` confirms to an attacker that the resource exists.
- **Required Behavior:** Return `404 Not Found`. To the requesting user, the resource does not exist.

### 3.3 Authorization Enforcement Pattern
Every database query involving user-owned data must bind `userId: session.user.id` into the query predicates:

```typescript
// SECURE AUTHORIZATION PATTERN
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues } }, { status: 400 });
  }

  // Atomic update scoped strictly to current user's ownership
  const result = await prisma.task.updateMany({
    where: {
      id: params.id,
      userId: session.user.id, // Mandatory tenant isolation boundary
    },
    data: parsed.data,
  });

  if (result.count === 0) {
    // Returns 404 whether task is missing OR owned by someone else
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, { status: 404 });
  }

  const updatedTask = await prisma.task.findUnique({ where: { id: params.id } });
  return NextResponse.json({ data: updatedTask });
}
```

---

## 4. Input Validation & Injection Prevention

### 4.1 Strict Schema Enforcement (Zod)
- Every external input (JSON bodies, query strings, URL route parameters) is evaluated through an immutable Zod schema.
- Excess fields in JSON payloads are stripped (`z.object({...}).strict()` or default stripping) to prevent mass assignment vulnerabilities.

### 4.2 SQL Injection Immunity
- All database communications route through **Prisma ORM**, which generates parameterized SQL statements (`$1, $2, ...`) for all queries.
- Raw SQL (`$queryRaw`) is prohibited unless required for complex analytics. If used, it must strictly use Prisma's parameterized template tag:
  ```typescript
  // SAFE: Parameterized template literal
  await prisma.$queryRaw`SELECT * FROM "FocusSession" WHERE "userId" = ${session.user.id}`;

  // PROHIBITED: String interpolation
  // await prisma.$queryRawUnsafe(`SELECT * FROM "FocusSession" WHERE "userId" = '${session.user.id}'`);
  ```

### 4.3 Cross-Site Scripting (XSS) Mitigation
- React automatically escapes strings before rendering into the DOM.
- `dangerouslySetInnerHTML` is banned across the entire codebase (enforced via ESLint rule `react/no-danger`).
- User profile avatars and images must conform to HTTPS URL formats validated via Zod.

---

## 5. Rate Limiting & Denial-of-Service Defense

To prevent credential stuffing, brute-force password cracking, and API flooding, rate limiting is implemented at the Edge via Vercel Edge Middleware / Upstash Redis:

| Route Group | Limit | Window | Action on Breach |
|---|---|---|---|
| `/api/auth/login` | 10 requests | 15 minutes per IP | `429 Too Many Requests` + Retry-After header |
| `/api/auth/register` | 5 requests | 1 hour per IP | `429 Too Many Requests` |
| `/api/focus-sessions` (Mutations) | 30 requests | 1 minute per User | `429 Too Many Requests` |
| Standard API Routes | 300 requests | 1 minute per User | `429 Too Many Requests` |

---

## 6. HTTP Security Headers & Content Security Policy (CSP)

Configured globally via `next.config.ts`:

```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' }, // Mitigates clickjacking
  { key: 'X-Content-Type-Options', value: 'nosniff' }, // Mitigates MIME sniffing
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Strict CSP nonce added in production build
      "style-src 'self' 'unsafe-inline'",               // Required for Tailwind CSS
      "img-src 'self' data: https: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];
```

---

## 7. Secrets Management & Environment Isolation

### 7.1 Separation of Keys
- **Client-Accessible (`NEXT_PUBLIC_*`):** Contains only public configuration (e.g. Sentry public DSN, application environment name).
- **Server-Only (Private):** All database connection strings (`DATABASE_URL`), session secrets (`AUTH_SECRET`), and future OAuth client secrets have no `NEXT_PUBLIC_` prefix and are unreachable from browser JS.

### 7.2 Git Discipline
- `.env`, `.env.local`, `.env.production` are strictly listed in `.gitignore`.
- `.env.example` provides the documented template without real credentials.
- CI pipeline scans commits using `git-secrets` / GitHub Secret Scanning to block accidental token commits.

---

## 8. Logging, PII & Audit Rules

1. **No Sensitive Data in Logs:** Passwords, password hashes, session tokens, and full email addresses are prohibited from logger outputs.
2. **Structured Sanitization:** Pino logger serializes request metadata as:
   ```typescript
   logger.info({
     event: 'focus_session_completed',
     userId: session.user.id,
     sessionId: session.id,
     duration: session.actualDuration
   });
   ```
3. **GDPR Account Deletion:** Invoking account deletion triggers a transactional cascade removing all associated `UserSettings`, `Project`, `Task`, `FocusSession`, and `Goal` rows immediately.
