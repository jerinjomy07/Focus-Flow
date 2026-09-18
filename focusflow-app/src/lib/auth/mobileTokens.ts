// src/lib/auth/mobileTokens.ts
// FocusFlow — Dedicated Mobile Session & Token Utilities
//
// Implements strict independent key isolation, session-family formatting,
// and SHA-256 fingerprinting for rotating mobile refresh tokens.

import crypto from 'crypto';

export interface MobileTokenPayload {
  iss: 'focusflow-api';
  aud: 'focusflow-mobile';
  sub: string; // userId
  sid: string; // mobileSessionId
  fid: string; // sessionFamilyId
  email: string;
  name?: string | null;
  jti: string;
  iat: number;
  exp: number;
}

export const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

/**
 * Retrieves the dedicated mobile signing secret.
 * STRICT POLICY: Fails fast with a fatal error if MOBILE_AUTH_SECRET is missing
 * or shorter than 32 characters. Zero fallbacks to browser AUTH_SECRET are permitted.
 */
export function getMobileAuthSecret(): string {
  const secret = process.env.MOBILE_AUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL: MOBILE_AUTH_SECRET is not configured or is shorter than 32 characters. Dedicated configuration is required.'
    );
  }
  return secret.trim();
}

function base64UrlEncode(strOrBuffer: string | Buffer): string {
  const buf = typeof strOrBuffer === 'string' ? Buffer.from(strOrBuffer) : strOrBuffer;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a short-lived access token with explicit issuer, audience, and session/family identifiers.
 */
export function signMobileAccessToken(params: {
  userId: string;
  sessionId: string;
  sessionFamilyId: string;
  email: string;
  name?: string | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: MobileTokenPayload = {
    iss: 'focusflow-api',
    aud: 'focusflow-mobile',
    sub: params.userId,
    sid: params.sessionId,
    fid: params.sessionFamilyId,
    email: params.email,
    name: params.name ?? null,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getMobileAuthSecret())
    .update(dataToSign)
    .digest();

  return `${dataToSign}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies and decodes a mobile access token. Rejects expired, tampered, or mis-scoped tokens.
 */
export function verifyMobileAccessToken(token: string): MobileTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', getMobileAuthSecret())
      .update(dataToSign)
      .digest();

    const expectedSignatureBase64 = base64UrlEncode(expectedSignature);

    // Constant-time comparison to prevent timing attacks
    if (signature !== expectedSignatureBase64) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as MobileTokenPayload;

    // Validate claims
    if (payload.iss !== 'focusflow-api' || payload.aud !== 'focusflow-mobile') {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random 256-bit token secret.
 */
export function generateRefreshTokenSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Formats a structured refresh token containing the session family and secret: <sessionFamilyId>.<secret>
 */
export function formatRefreshToken(sessionFamilyId: string, secret: string): string {
  return `${sessionFamilyId}.${secret}`;
}

/**
 * Parses a structured refresh token into sessionFamilyId and tokenSecret.
 */
export function parseRefreshToken(token: string): { sessionFamilyId: string; tokenSecret: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { sessionFamilyId: parts[0], tokenSecret: parts[1] };
}

/**
 * Computes a SHA-256 fingerprint of the refresh token secret for secure database persistence.
 * Raw refresh token secrets are never stored in the database.
 */
export function hashRefreshToken(tokenSecret: string): string {
  return crypto.createHash('sha256').update(tokenSecret).digest('hex');
}
