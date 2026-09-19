// src/app/api/auth/reset-password/__tests__/reset-password-api.test.ts
// FocusFlow — Password Reset & OTP Dispatch API Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, VerificationToken } from '@prisma/client';
import { POST as sendOtpPost } from '../send-otp/route';
import { POST as resetPasswordPost } from '../route';
import * as dbModule from '@/lib/db';
import { prisma } from '@/lib/db/client';
import * as emailModule from '@/lib/email';

vi.mock('@/lib/db', () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    mobileSession: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetOtpEmail: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: {
    check: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  },
  getClientKey: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockGetUserByEmail = vi.mocked(dbModule.getUserByEmail);
const mockSendEmail = vi.mocked(emailModule.sendPasswordResetOtpEmail);

const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'usr-alex',
  email: 'alex@focusflow.app',
  name: 'Alex Vance',
  passwordHash: '$2b$12$somehashedpassword',
  timezone: 'UTC',
  image: null,
  emailVerified: null,
  onboardedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockToken = (overrides?: Partial<VerificationToken>): VerificationToken => ({
  identifier: 'alex@focusflow.app',
  token: '123456',
  expires: new Date(Date.now() + 600000),
  ...overrides,
});

describe('Password Reset OTP API — POST /api/auth/reset-password/send-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid email formats with VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const res = await sendOtpPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('protects against account enumeration: returns uniform success when email does not exist', async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/auth/reset-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown-pilot@focusflow.app' }),
    });

    const res = await sendOtpPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(json.data.message).toContain('If an account with this email address exists');
    // Ensure no token was created and no email was sent
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('creates single-use token and dispatches email when account exists', async () => {
    mockGetUserByEmail.mockResolvedValue(
      createMockUser({
        id: 'usr-alex',
        email: 'alex@focusflow.app',
        name: 'Alex Vance',
      })
    );

    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: 'msg-12345',
    });

    const req = new Request('http://localhost:3000/api/auth/reset-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@focusflow.app' }),
    });

    const res = await sendOtpPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(prisma.verificationToken.create).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith('alex@focusflow.app', expect.any(String));
  });

  it('surfaces delivery errors instead of silently swallowing them in production mode', async () => {
    const originalEnv = process.env;
    try {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_production_key',
      };

      mockGetUserByEmail.mockResolvedValue(
        createMockUser({
          id: 'usr-friend',
          email: 'friend@external.com',
          name: 'Friend User',
        })
      );

      mockSendEmail.mockResolvedValue({
        success: false,
        statusCode: 403,
        error: 'You can only send testing emails to your own email address.',
      });

      const req = new Request('http://localhost:3000/api/auth/reset-password/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: 'friend@external.com' }),
      });

      const res = await sendOtpPost(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error.code).toBe('EMAIL_DELIVERY_FAILED');
    } finally {
      process.env = originalEnv;
    }
  });
});

describe('Password Reset Verification — POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing or invalid 6-digit OTP format', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@focusflow.app',
        otp: '123', // Not 6 digits
        newPassword: 'securePassword123!',
      }),
    });

    const res = await resetPasswordPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short passwords (< 8 characters)', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@focusflow.app',
        otp: '123456',
        newPassword: 'short',
      }),
    });

    const res = await resetPasswordPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects expired OTPs and cleans up token', async () => {
    mockGetUserByEmail.mockResolvedValue(
      createMockUser({
        id: 'usr-alex',
        email: 'alex@focusflow.app',
      })
    );

    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(
      createMockToken({
        identifier: 'alex@focusflow.app',
        token: '654321',
        expires: new Date(Date.now() - 60000), // Expired 1 min ago
      })
    );

    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@focusflow.app',
        otp: '654321',
        newPassword: 'newValidPassword123!',
      }),
    });

    const res = await resetPasswordPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('EXPIRED_OTP');
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalled();
  });

  it('successfully updates password hash, deletes token, and revokes mobile sessions', async () => {
    mockGetUserByEmail.mockResolvedValue(
      createMockUser({
        id: 'usr-alex',
        email: 'alex@focusflow.app',
      })
    );

    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(
      createMockToken({
        identifier: 'alex@focusflow.app',
        token: '123456',
        expires: new Date(Date.now() + 600000), // 10 min remaining
      })
    );

    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@focusflow.app',
        otp: '123456',
        newPassword: 'newValidPassword123!',
      }),
    });

    const res = await resetPasswordPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);

    // Verify atomic password update, token cleanup, and session revocation
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usr-alex' },
      })
    );
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: 'alex@focusflow.app' },
    });
    expect(prisma.mobileSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr-alex', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
