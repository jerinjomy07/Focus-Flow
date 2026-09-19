// src/app/api/auth/reset-password/route.ts
// FocusFlow — User Password Reset Route Handler

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import { prisma } from '@/lib/db/client';
import { ResetPasswordSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';
import { authLimiter, getClientKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Rate limiting — 5 attempts per 60 seconds per IP
  const key = getClientKey(req);
  const rateLimit = await authLimiter.check(key);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many password reset requests. Please wait a moment and try again.' } },
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

    // Validate request schema
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid password reset input',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { email, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Look up user by email
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No FocusFlow account exists with this email address.',
          },
        },
        { status: 404 }
      );
    }

    // Hash new password using bcrypt with cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password hash atomically
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke any existing mobile sessions for security
    await prisma.mobileSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({
      data: {
        success: true,
        message: 'Password reset successfully. You can now sign in with your new password.',
      },
    });
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
