# ADR-008: PostgreSQL with Prisma ORM over Drizzle / Raw SQL

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team  

---

## 1. Context

FocusFlow requires a resilient, relational persistence layer to manage multi-tenant productivity records, user profiles, hierarchical project-task structures, and immutable time-series focus sessions. We evaluated three primary data layer strategies:

1. **PostgreSQL with Prisma ORM**
2. **PostgreSQL with Drizzle ORM**
3. **PostgreSQL with Raw SQL / Kysely**

---

## 2. Decision

Use **PostgreSQL** coupled with **Prisma ORM 5.x**.

---

## 3. Rationale & Tradeoff Analysis

### Why PostgreSQL
- Productivity tracking is fundamentally relational (Users own Projects, Projects contain Tasks, Focus Sessions link to Tasks and Projects).
- PostgreSQL provides battle-tested ACID compliance, strong foreign key constraints, rich datetime and timezone capabilities, and performant aggregation primitives.

### Why Prisma ORM
| Dimension | Prisma ORM | Drizzle ORM | Raw SQL / Kysely |
|---|---|---|---|
| **Ecosystem Maturity** | Extreme (Industry standard for Next.js) | Emerging | High (SQL itself) |
| **Auth.js Integration** | Official, battle-tested `@auth/prisma-adapter` | Newer adapter | Requires custom session handlers |
| **Schema Readability** | Declarative `.prisma` DSL (single source of truth) | TypeScript table objects | Separate `.sql` migration files |
| **Type Safety** | Fully auto-generated client types | Inferred TS types | Manual or codegen interfaces |
| **Migration Tooling** | `prisma migrate` handles declarative diffing & tracking | `drizzle-kit` | Manual SQL script sequencing |
| **Productivity** | High ergonomic speed, intuitive relation syntax | High | Lower (repetitive boilerplate) |

- **Official Auth.js v5 Support:** The Prisma adapter for Auth.js is mature, actively maintained, and handles user accounts, sessions, and verification tokens with zero bespoke glue code.
- **Relational Ergonomics:** Prisma's intuitive nested relation queries (`include: { project: true }`) streamline application service orchestration while generating safe, parameterized SQL.
- **Migration Determinism:** Prisma Migrate maintains a clean, version-controlled history of schema changes that can be deployed reproducibly across local, preview, and production environments.

---

## 4. Accepted Tradeoffs & Mitigations

- **Edge Runtime Incompatibility:** The standard Prisma Client runs on the Node.js runtime and cannot execute in Vercel Edge Runtime without the Prisma Accelerate proxy.
  - *Mitigation:* All database-interacting Route Handlers and Server Components are explicitly targeted to the Node.js runtime (`export const runtime = 'nodejs'`), where serverless performance is optimal and connection pooling is managed via PgBouncer.
- **Query Performance Overhead:** Prisma generates slightly more verbose SQL queries than hand-tuned Drizzle or raw queries.
  - *Mitigation:* All key analytical queries are properly indexed (e.g. `[userId, startedAt]`). If any future complex analytics query requires hand-tuning, Prisma provides safe parameterized `$queryRaw` access.

---

## 5. Consequences

- `prisma/schema.prisma` is the authoritative source of truth for the database structure.
- Migrations are generated via `prisma migrate dev` and applied in CI/CD via `prisma migrate deploy`.
- TypeScript domain types inherit or map directly from `@prisma/client`.
