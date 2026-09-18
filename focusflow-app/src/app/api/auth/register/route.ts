// src/app/api/auth/register/route.ts
// FocusFlow — User Registration API Route Handler

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import { RegisterSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';
import { authLimiter, getClientKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Rate limiting — 10 requests per 60 seconds per IP
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

    // 1. Zod input validation
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration input',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Uniqueness check
    const existing = await db.getUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists',
          },
        },
        { status: 409 }
      );
    }

    // 3. Password hashing with bcrypt (cost factor 12)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Atomic user creation + default settings provisioning
    const user = await db.createUser({
      name,
      email: normalizedEmail,
      passwordHash,
    });

    // 5. Return sanitized response
    return NextResponse.json(
      {
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            timezone: user.timezone,
            createdAt: user.createdAt,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}
