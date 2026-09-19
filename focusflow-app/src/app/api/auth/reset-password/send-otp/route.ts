// src/app/api/auth/reset-password/send-otp/route.ts
// FocusFlow — Password Reset OTP Dispatcher Route Handler

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as db from '@/lib/db';
import { prisma } from '@/lib/db/client';
import { SendPasswordResetOtpSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';
import { authLimiter, getClientKey } from '@/lib/rate-limit';
import { sendPasswordResetOtpEmail } from '@/lib/email';

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
          message: 'Too many requests. Please wait a moment before requesting another code.',
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

    // Validate email payload
    const parsed = SendPasswordResetOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email address format',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    // Verify account exists
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user) {
      // Return uniform success message to protect against account enumeration
      return NextResponse.json({
        data: {
          success: true,
          message: `If an account with this email address exists, a 6-digit verification code has been dispatched.`,
        },
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any old verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    // Save token in database
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: otp,
        expires,
      },
    });

    // Dispatch email
    const emailResult = await sendPasswordResetOtpEmail(normalizedEmail, otp);

    // If email delivery explicitly failed, never swallow the error silently
    if (!emailResult.success) {
      // In development or test environments, allow devOtp fallback for local tests
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.RESEND_API_KEY) {
        return NextResponse.json({
          data: {
            success: true,
            message: `Verification code generated (fallback mode).`,
            devOtp: emailResult.devOtp || otp,
          },
        });
      }

      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_DELIVERY_FAILED',
            message: emailResult.error || 'Failed to deliver verification code email. Please contact support.',
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: {
        success: true,
        message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
        devOtp: emailResult.devOtp,
      },
    });
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
