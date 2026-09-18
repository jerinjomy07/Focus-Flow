// src/lib/db/client.ts
// FocusFlow — Authoritative Prisma Client Instance
// Implements the global singleton pattern required in Next.js development
// to prevent connection pool exhaustion across hot-reloads.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

// Cache the singleton on globalThis to prevent connection exhaustion in serverless environments
globalForPrisma.prisma = prisma;

export default prisma;
