# FocusFlow Application

A production-quality Pomodoro productivity platform built with Next.js, TypeScript, PostgreSQL, and Prisma.

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or a managed provider like Neon)
- npm 10+

## Local Development Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

### 3. Database setup

```bash
# Run migrations
npx prisma migrate dev

# Seed development data
npx prisma db seed
```

### 4. Start development server

```bash
npm run dev
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run type-check` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run test` | Run unit + integration tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:e2e` | Playwright E2E tests |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma migrate dev` | Create + apply migration |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma db seed` | Seed development data |

## Documentation

See `/docs/` for complete architectural documentation:
- [`/docs/architecture.md`](./docs/architecture.md) — Master architecture
- [`/docs/database-architecture.md`](./docs/database-architecture.md) — Database schema
- [`/docs/timer-architecture.md`](./docs/timer-architecture.md) — Timer engine
- [`/docs/api-architecture.md`](./docs/api-architecture.md) — API contracts
- [`/docs/security-architecture.md`](./docs/security-architecture.md) — Security
