// src/app/api/auth/reset-password/route.ts
// FocusFlow — User Password Reset with Verified OTP Route Handler

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
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many password reset attempts. Please wait a moment and try again.',
        },
      },
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

    // Validate request schema (strictly requires email, 6-digit otp, and newPassword)
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

    const { email, otp, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Look up user by email
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

    // 2. Validate OTP against VerificationToken table
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: otp.trim(),
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_OTP',
            message: 'Invalid verification code. Please check your email and enter the correct code.',
          },
        },
        { status: 400 }
      );
    }

    if (tokenRecord.expires < new Date()) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });
      return NextResponse.json(
        {
          error: {
            code: 'EXPIRED_OTP',
            message: 'This verification code has expired. Please request a new code.',
          },
        },
        { status: 400 }
      );
    }

    // 3. Hash new password using bcrypt with cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 4. Update password hash atomically
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // 5. Consume and delete the verification token so it cannot be reused
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    // 6. Revoke any existing mobile sessions for security
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
