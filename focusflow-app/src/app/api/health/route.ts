// src/app/api/health/route.ts
// FocusFlow — Production Liveness and Readiness Health Endpoint
//
// Exposes lightweight health state for uptime monitors (Vercel, Pingdom, BetterStack).
// Verifies database connectivity using an efficient single-row probe (SELECT 1).
// STRICTLY GUARDS against leaking internal connection strings, secrets, or stack traces.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Lightweight database connectivity check
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        database: {
          status: 'connected',
          latencyMs: dbLatencyMs,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown DB error' },
      'Health probe failed database connectivity check'
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        database: {
          status: 'disconnected',
        },
        error: 'Database connection failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
