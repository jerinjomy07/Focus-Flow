// src/app/api/auth/mobile/__tests__/mobile-session-lifecycle.test.ts
// FocusFlow — Mobile Session Family Lifecycle, Replay Revocation & Security Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signMobileAccessToken,
  verifyMobileAccessToken,
  generateRefreshTokenSecret,
  formatRefreshToken,
  parseRefreshToken,
  hashRefreshToken,
  getMobileAuthSecret,
} from '@/lib/auth/mobileTokens';
import { prisma } from '@/lib/db/client';

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

const mockMobileSession = vi.mocked(prisma.mobileSession);

describe('Mobile Session Family Security & Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOBILE_AUTH_SECRET = 'super-secret-isolated-mobile-key-32chars!';
  });

  describe('1. Secret Configuration Policy (Zero Fallbacks)', () => {
    it('throws a fatal error if MOBILE_AUTH_SECRET is missing or too short', () => {
      delete process.env.MOBILE_AUTH_SECRET;
      expect(() => getMobileAuthSecret()).toThrow(/FATAL: MOBILE_AUTH_SECRET is not configured/);

      process.env.MOBILE_AUTH_SECRET = 'short';
      expect(() => getMobileAuthSecret()).toThrow(/FATAL: MOBILE_AUTH_SECRET is not configured/);
    });

    it('returns valid secret when explicitly configured with >= 32 chars', () => {
      process.env.MOBILE_AUTH_SECRET = 'this-is-a-valid-secret-key-that-is-at-least-32-chars-long';
      expect(getMobileAuthSecret()).toBe('this-is-a-valid-secret-key-that-is-at-least-32-chars-long');
    });
  });

  describe('2. Token Issuance, Scoping & Expiration', () => {
    it('signs and verifies mobile access token with explicit sessionFamilyId claims', () => {
      const token = signMobileAccessToken({
        userId: 'usr_1',
        sessionId: 'msess_1',
        sessionFamilyId: 'fam_123',
        email: 'user@focusflow.app',
        name: 'Alex',
      });

      const payload = verifyMobileAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('usr_1');
      expect(payload?.sid).toBe('msess_1');
      expect(payload?.fid).toBe('fam_123');
      expect(payload?.iss).toBe('focusflow-api');
      expect(payload?.aud).toBe('focusflow-mobile');
    });

    it('rejects tampered access tokens', () => {
      const token = signMobileAccessToken({
        userId: 'usr_1',
        sessionId: 'msess_1',
        sessionFamilyId: 'fam_1',
        email: 'user@focusflow.app',
      });

      const tampered = token.slice(0, -4) + 'zzzz';
      expect(verifyMobileAccessToken(tampered)).toBeNull();
    });

    it('rejects expired access tokens', () => {
      const crypto = require('crypto');
      const expiredPayload = {
        iss: 'focusflow-api',
        aud: 'focusflow-mobile',
        sub: 'usr_1',
        sid: 'msess_1',
        fid: 'fam_1',
        email: 'user@focusflow.app',
        jti: 'uuid-1',
        iat: Math.floor(Date.now() / 1000) - 2000,
        exp: Math.floor(Date.now() / 1000) - 1000,
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const data = `${header}.${payload}`;
      const sig = crypto.createHmac('sha256', process.env.MOBILE_AUTH_SECRET).update(data).digest('base64url');

      expect(verifyMobileAccessToken(`${data}.${sig}`)).toBeNull();
    });
  });

  describe('3. Refresh Token Rotation & Session-Family Handling', () => {
    it('successfully rotates refresh token and updates hash conditionally', async () => {
      const sessionFamilyId = 'fam_test_001';
      const secret = generateRefreshTokenSecret();
      const currentHash = hashRefreshToken(secret);
      const rawToken = formatRefreshToken(sessionFamilyId, secret);

      mockMobileSession.findFirst.mockResolvedValue({
        id: 'msess_001',
        userId: 'usr_001',
        sessionFamilyId,
        refreshTokenHash: currentHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'usr_001', email: 'test@focusflow.app', name: 'User' },
      } as any);

      mockMobileSession.updateMany.mockResolvedValue({ count: 1 });

      const { POST: refreshRoute } = await import('../refresh/route');
      const req = new Request('http://localhost/api/auth/mobile/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rawToken }),
      });

      const res = await refreshRoute(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken).not.toBe(rawToken);

      // Verify new token has same sessionFamilyId but different secret
      const parsedNew = parseRefreshToken(body.data.refreshToken);
      expect(parsedNew?.sessionFamilyId).toBe(sessionFamilyId);
      expect(parsedNew?.tokenSecret).not.toBe(secret);

      // Conditional atomic update was executed
      expect(mockMobileSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionFamilyId,
            refreshTokenHash: currentHash,
            revokedAt: null,
          }),
        })
      );
    });

    it('rejects simultaneous refresh collisions with 409 CONCURRENT_REFRESH', async () => {
      const sessionFamilyId = 'fam_race';
      const secret = generateRefreshTokenSecret();
      const rawToken = formatRefreshToken(sessionFamilyId, secret);

      mockMobileSession.findFirst.mockResolvedValue({
        id: 'msess_race',
        userId: 'usr_race',
        sessionFamilyId,
        refreshTokenHash: hashRefreshToken(secret),
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'usr_race', email: 'race@focusflow.app' },
      } as any);

      // Simulate atomic conditional update failure (another process already updated it)
      mockMobileSession.updateMany.mockResolvedValue({ count: 0 });

      const { POST: refreshRoute } = await import('../refresh/route');
      const req = new Request('http://localhost/api/auth/mobile/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rawToken }),
      });

      const res = await refreshRoute(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONCURRENT_REFRESH');
    });
  });

  describe('4. Cryptographic Replay Detection & Session-Family Revocation', () => {
    it('detects replay of stale refresh token and revokes entire session family', async () => {
      const sessionFamilyId = 'fam_compromised';
      const staleSecret = generateRefreshTokenSecret();
      const currentActiveSecret = generateRefreshTokenSecret(); // Current active hash in DB
      const staleToken = formatRefreshToken(sessionFamilyId, staleSecret);

      mockMobileSession.findFirst.mockResolvedValue({
        id: 'msess_compromised',
        userId: 'usr_victim',
        sessionFamilyId,
        refreshTokenHash: hashRefreshToken(currentActiveSecret), // Active secret differs from staleSecret
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'usr_victim', email: 'victim@focusflow.app' },
      } as any);

      mockMobileSession.updateMany.mockResolvedValue({ count: 1 });

      const { POST: refreshRoute } = await import('../refresh/route');
      const req = new Request('http://localhost/api/auth/mobile/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: staleToken }),
      });

      const res = await refreshRoute(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('REPLAY_DETECTED');

      // Verified that entire session family was revoked in DB
      expect(mockMobileSession.updateMany).toHaveBeenCalledWith({
        where: { sessionFamilyId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects refresh attempt on an already revoked session family', async () => {
      const sessionFamilyId = 'fam_revoked';
      const secret = generateRefreshTokenSecret();
      const rawToken = formatRefreshToken(sessionFamilyId, secret);

      mockMobileSession.findFirst.mockResolvedValue({
        id: 'msess_revoked',
        userId: 'usr_1',
        sessionFamilyId,
        refreshTokenHash: hashRefreshToken(secret),
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Already revoked
        user: { id: 'usr_1', email: 'user@focusflow.app' },
      } as any);

      const { POST: refreshRoute } = await import('../refresh/route');
      const req = new Request('http://localhost/api/auth/mobile/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rawToken }),
      });

      const res = await refreshRoute(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('SESSION_REVOKED');
    });
  });

  describe('5. Multi-Device Independence', () => {
    it('revoking one device session family leaves other device families active', async () => {
      const user = { id: 'usr_multi', email: 'multi@focusflow.app' };

      const familyA = 'fam_device_phone';
      const familyB = 'fam_device_tablet';

      let familyARevoked: Date | null = null;
      let familyBRevoked: Date | null = null;

      (mockMobileSession.updateMany as any).mockImplementation(async ({ where }: any) => {
        if (where.sessionFamilyId === familyA) {
          familyARevoked = new Date();
          return { count: 1 };
        }
        if (where.sessionFamilyId === familyB) {
          familyBRevoked = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      });

      // Logout request from Device A
      const { POST: logoutRoute } = await import('../logout/route');
      const req = new Request('http://localhost/api/auth/mobile/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: formatRefreshToken(familyA, 'secret_a') }),
      });

      await logoutRoute(req);

      // Only Device A family is revoked
      expect(familyARevoked).not.toBeNull();
      // Device B family remains completely active
      expect(familyBRevoked).toBeNull();
    });
  });
});
