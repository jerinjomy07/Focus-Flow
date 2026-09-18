// src/app/api/auth/mobile/refresh/route.ts
// FocusFlow — Mobile Session Refresh, Atomic Rotation & Replay Revocation Endpoint
//
// Identifies session family, detects replay of previously rotated tokens and revokes
// the entire session family, and executes atomic conditional rotation to prevent race conditions.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authLimiter, getClientKey } from '@/lib/rate-limit';
import { toErrorResponse } from '@/lib/errors';
import {
  signMobileAccessToken,
  generateRefreshTokenSecret,
  formatRefreshToken,
  parseRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/mobileTokens';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Rate limiting — prevents refresh token brute-forcing
  const key = getClientKey(req);
  const rateLimit = await authLimiter.check(key);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const refreshToken = body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing refreshToken in request body' } },
        { status: 400 }
      );
    }

    // 1. Parse structured refresh token into sessionFamilyId and secret
    const parsed = parseRefreshToken(refreshToken.trim());
    if (!parsed) {
      return NextResponse.json(
        { error: { code: 'MALFORMED_TOKEN', message: 'Invalid refresh token structure' } },
        { status: 400 }
      );
    }

    const { sessionFamilyId, tokenSecret } = parsed;
    const providedHash = hashRefreshToken(tokenSecret);

    // 2. Identify the mobile session family
    const session = await prisma.mobileSession.findFirst({
      where: { sessionFamilyId },
      include: { user: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: { code: 'INVALID_SESSION', message: 'Session family does not exist' } },
        { status: 401 }
      );
    }

    // 3. Check if session family was already revoked
    if (session.revokedAt) {
      return NextResponse.json(
        { error: { code: 'SESSION_REVOKED', message: 'Mobile session family has been revoked' } },
        { status: 401 }
      );
    }

    // 4. Check expiration
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'SESSION_EXPIRED', message: 'Mobile session has expired' } },
        { status: 401 }
      );
    }

    // 5. CRYPTOGRAPHIC REPLAY DETECTION:
    // If the provided hash does not match the active hash, a stale/previously rotated token is being reused!
    if (session.refreshTokenHash !== providedHash) {
      // Replay detected! Revoke the entire session family immediately to protect user security
      await prisma.mobileSession.updateMany({
        where: { sessionFamilyId },
        data: { revokedAt: new Date() },
      });

      return NextResponse.json(
        {
          error: {
            code: 'REPLAY_DETECTED',
            message: 'Refresh token reuse detected. Session family has been revoked for security.',
          },
        },
        { status: 401 }
      );
    }

    // 6. ATOMIC CONDITIONAL ROTATION:
    // Generate new secret and update with conditional where clause to prevent race conditions
    const newSecret = generateRefreshTokenSecret();
    const newHash = hashRefreshToken(newSecret);

    const updateResult = await prisma.mobileSession.updateMany({
      where: {
        id: session.id,
        sessionFamilyId,
        refreshTokenHash: providedHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Race condition collision: another concurrent request already rotated the token
      return NextResponse.json(
        { error: { code: 'CONCURRENT_REFRESH', message: 'Concurrent token refresh collision' } },
        { status: 409 }
      );
    }

    // 7. Issue fresh tokens
    const newRefreshToken = formatRefreshToken(sessionFamilyId, newSecret);
    const newAccessToken = signMobileAccessToken({
      userId: session.userId,
      sessionId: session.id,
      sessionFamilyId,
      email: session.user.email,
      name: session.user.name,
    });

    return NextResponse.json(
      {
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
          sessionId: session.id,
          sessionFamilyId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
