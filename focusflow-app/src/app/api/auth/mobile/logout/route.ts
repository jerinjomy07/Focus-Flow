// src/app/api/auth/mobile/logout/route.ts
// FocusFlow — Mobile Session Family Server-Side Revocation Endpoint
//
// Revokes the targeted MobileSession family in PostgreSQL by setting revokedAt = now().
// Once revoked, neither the access token nor the refresh token family can be used.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db/client';
import { verifyMobileAccessToken, parseRefreshToken } from '@/lib/auth/mobileTokens';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    let revokedCount = 0;

    // 1. Try to extract session family from Bearer access token
    try {
      const headerList = await headers();
      const authHeader = headerList.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        const payload = verifyMobileAccessToken(token);
        if (payload?.fid) {
          const res = await prisma.mobileSession.updateMany({
            where: { sessionFamilyId: payload.fid, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          revokedCount += res.count;
        } else if (payload?.sid) {
          const res = await prisma.mobileSession.updateMany({
            where: { id: payload.sid, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          revokedCount += res.count;
        }
      }
    } catch {
      // Header extraction fallback
    }

    // 2. Also check if a refreshToken was provided in JSON body
    try {
      const body = await req.json();
      if (typeof body?.refreshToken === 'string' && body.refreshToken.trim()) {
        const parsed = parseRefreshToken(body.refreshToken.trim());
        if (parsed?.sessionFamilyId) {
          const res = await prisma.mobileSession.updateMany({
            where: { sessionFamilyId: parsed.sessionFamilyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          revokedCount += res.count;
        }
      }
    } catch {
      // Body was not JSON or empty
    }

    return NextResponse.json(
      {
        data: {
          success: true,
          message: 'Mobile session family revoked successfully',
          revoked: revokedCount > 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
