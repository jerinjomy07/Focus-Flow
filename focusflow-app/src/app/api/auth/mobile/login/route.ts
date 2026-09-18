// src/app/api/auth/mobile/login/route.ts
// FocusFlow — Standalone Mobile Client Authentication Endpoint
//
// Authenticates credentials for native mobile clients (React Native/Expo)
// creates a server-side MobileSession record in PostgreSQL with sessionFamilyId,
// and returns a short-lived access token + rotating refresh token pair.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import { prisma } from '@/lib/db/client';
import { LoginSchema } from '@/lib/validations';
import { authLimiter, getClientKey } from '@/lib/rate-limit';
import { toErrorResponse } from '@/lib/errors';
import {
  signMobileAccessToken,
  generateRefreshTokenSecret,
  formatRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@/lib/auth/mobileTokens';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Rate limiting — 10 attempts per 60 seconds per IP
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

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid credentials payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Query user
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Verify bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Generate stable session-family identifier and rotating refresh secret
    const sessionFamilyId = crypto.randomUUID();
    const tokenSecret = generateRefreshTokenSecret();
    const refreshTokenHash = hashRefreshToken(tokenSecret);
    const rawRefreshToken = formatRefreshToken(sessionFamilyId, tokenSecret);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Device metadata (default to Android)
    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.slice(0, 100) : 'Android Device';
    const deviceType = typeof body.deviceType === 'string' ? body.deviceType.slice(0, 50) : 'android';

    // Create server-side MobileSession record with sessionFamilyId
    const mobileSession = await prisma.mobileSession.create({
      data: {
        userId: user.id,
        sessionFamilyId,
        refreshTokenHash,
        deviceName,
        deviceType,
        expiresAt,
      },
    });

    // Issue short-lived access token
    const accessToken = signMobileAccessToken({
      userId: user.id,
      sessionId: mobileSession.id,
      sessionFamilyId,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json(
      {
        data: {
          accessToken,
          refreshToken: rawRefreshToken,
          expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
          sessionId: mobileSession.id,
          sessionFamilyId,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            timezone: user.timezone,
            onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
