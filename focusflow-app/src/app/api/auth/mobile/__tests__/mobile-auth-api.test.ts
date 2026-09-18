// src/app/api/auth/mobile/__tests__/mobile-auth-api.test.ts
// FocusFlow — Mobile Authentication API Route Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { POST as loginPOST } from '../login/route';
import { GET as sessionGET } from '../session/route';
import { POST as logoutPOST } from '../logout/route';
import { POST as refreshPOST } from '../refresh/route';
import * as dbModule from '@/lib/db';
import * as authModule from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { formatRefreshToken, hashRefreshToken } from '@/lib/auth/mobileTokens';

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    mobileSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const mockGetUserByEmail = vi.mocked(dbModule.getUserByEmail as unknown as (email: string) => Promise<unknown>);
const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockMobileSession = vi.mocked(prisma.mobileSession);

describe('Mobile Auth — POST /api/auth/mobile/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = '01234567890123456789012345678901';
    process.env.MOBILE_AUTH_SECRET = 'mobile_auth_secret_key_at_least_32_characters_long_for_test';
  });

  it('rejects invalid email formatting with 400 validation error', async () => {
    const req = new Request('http://localhost/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty password with 400 validation error', async () => {
    const req = new Request('http://localhost/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: '' }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 on non-existent email', async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    const req = new Request('http://localhost/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com', password: 'validPassword123' }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 on incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correctPassword123', 10);
    mockGetUserByEmail.mockResolvedValue({
      id: 'usr_1',
      name: 'Mobile User',
      email: 'mobile@example.com',
      passwordHash,
      timezone: 'America/New_York',
      onboardedAt: new Date(),
    });

    const req = new Request('http://localhost/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'mobile@example.com', password: 'wrongPassword456' }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('creates MobileSession with sessionFamilyId and issues short-lived accessToken + rotating refreshToken', async () => {
    const rawPassword = 'validPassword123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    mockGetUserByEmail.mockResolvedValue({
      id: 'usr_mobile_1',
      name: 'Android Tester',
      email: 'android@example.com',
      passwordHash,
      timezone: 'Europe/London',
      onboardedAt: new Date('2026-09-17T12:00:00Z'),
    });

    mockMobileSession.create.mockResolvedValue({
      id: 'msess_1',
      userId: 'usr_mobile_1',
      sessionFamilyId: 'fam_123',
      refreshTokenHash: 'mock_hash',
      deviceName: 'Pixel 10',
      deviceType: 'android',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      revokedAt: null,
    } as never);

    const req = new Request('http://localhost/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'android@example.com', password: rawPassword, deviceName: 'Pixel 10' }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.refreshToken).toContain('.'); // structured <familyId>.<secret>
    expect(body.data.expiresIn).toBe(900); // 15 minutes
    expect(body.data.sessionId).toBe('msess_1');
    expect(body.data.sessionFamilyId).toBeDefined();
    expect(body.data.user.id).toBe('usr_mobile_1');
    expect(body.data.user.email).toBe('android@example.com');
    expect(mockMobileSession.create).toHaveBeenCalledOnce();
  });
});

describe('Mobile Auth — POST /api/auth/mobile/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOBILE_AUTH_SECRET = 'mobile_auth_secret_key_at_least_32_characters_long_for_test';
  });

  it('returns 400 when refreshToken is missing', async () => {
    const req = new Request('http://localhost/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await refreshPOST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when refreshToken structure is malformed', async () => {
    const req = new Request('http://localhost/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'not-a-valid-structured-token' }),
    });

    const res = await refreshPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('MALFORMED_TOKEN');
  });

  it('returns 401 if session family does not exist in database', async () => {
    mockMobileSession.findFirst.mockResolvedValue(null);

    const req = new Request('http://localhost/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'unknown_fam.token_123' }),
    });

    const res = await refreshPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SESSION');
  });

  it('returns 401 if mobile session family has been revoked', async () => {
    mockMobileSession.findFirst.mockResolvedValue({
      id: 'msess_1',
      userId: 'usr_1',
      sessionFamilyId: 'fam_revoked',
      refreshTokenHash: hashRefreshToken('secret_abc'),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'usr_1', email: 'user@example.com', name: 'User' },
    } as never);

    const req = new Request('http://localhost/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: formatRefreshToken('fam_revoked', 'secret_abc') }),
    });

    const res = await refreshPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('SESSION_REVOKED');
  });

  it('successfully rotates refresh token and returns new access + refresh token', async () => {
    const familyId = 'fam_valid';
    const secret = 'valid_secret_12345';
    mockMobileSession.findFirst.mockResolvedValue({
      id: 'msess_1',
      userId: 'usr_1',
      sessionFamilyId: familyId,
      refreshTokenHash: hashRefreshToken(secret),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'usr_1', email: 'user@example.com', name: 'User' },
    } as never);

    mockMobileSession.updateMany.mockResolvedValue({ count: 1 });

    const req = new Request('http://localhost/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: formatRefreshToken(familyId, secret) }),
    });

    const res = await refreshPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.refreshToken).not.toBe(formatRefreshToken(familyId, secret)); // rotated
    expect(mockMobileSession.updateMany).toHaveBeenCalledOnce();
  });
});

describe('Mobile Auth — GET /api/auth/mobile/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await sessionGET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns current user session when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'usr_mobile_1',
        name: 'Android Tester',
        email: 'android@example.com',
        timezone: 'UTC',
        onboardedAt: '2026-09-17T12:00:00Z',
      },
    });

    const res = await sessionGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.id).toBe('usr_mobile_1');
    expect(body.data.user.email).toBe('android@example.com');
  });
});

describe('Mobile Auth — POST /api/auth/mobile/logout', () => {
  it('returns 200 with server-side revocation confirmation', async () => {
    mockMobileSession.updateMany.mockResolvedValue({ count: 1 });

    const req = new Request('http://localhost/api/auth/mobile/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: formatRefreshToken('fam_kill', 'secret_kill') }),
    });

    const res = await logoutPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
    expect(mockMobileSession.updateMany).toHaveBeenCalledWith({
      where: { sessionFamilyId: 'fam_kill', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
