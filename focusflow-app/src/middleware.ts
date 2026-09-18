// src/middleware.ts
// FocusFlow — Route Protection, Onboarding Redirect & Security Middleware

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { authLimiter, getClientKey } from '@/lib/rate-limit';

/**
 * Derive the canonical host from a request for CSRF/Origin validation.
 * Prefers the x-forwarded-host header (set by proxies/Vercel) over the
 * raw Host header for correctness in production deployments.
 */
function getRequestHost(req: Request): string {
  const forwardedHost = (req.headers as Headers).get('x-forwarded-host');
  const host = (req.headers as Headers).get('host');
  return forwardedHost ?? host ?? '';
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth?.user;
  const isOnboarded = !!req.auth?.user?.onboardedAt;

  const isAuthRoute =
    nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register');
  const isOnboardingRoute = nextUrl.pathname.startsWith('/onboarding');
  const isProtectedRoute =
    nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/focus') ||
    nextUrl.pathname.startsWith('/tasks') ||
    nextUrl.pathname.startsWith('/projects') ||
    nextUrl.pathname.startsWith('/analytics') ||
    nextUrl.pathname.startsWith('/settings') ||
    nextUrl.pathname.startsWith('/history');

  const method = req.method?.toUpperCase();

  // ──────────────────────────────────────────────────────────────
  // Rate Limiting for Auth.js Login Endpoint
  // The NextAuth credentials callback is POST /api/auth/callback/credentials.
  // Its handler is embedded inside the Auth.js `handlers` bundle and cannot
  // be wrapped directly. Middleware is the correct interception point.
  // Same authLimiter (10 req / 60s per IP) as the registration endpoint.
  // ──────────────────────────────────────────────────────────────
  const isLoginCallback =
    method === 'POST' && nextUrl.pathname === '/api/auth/callback/credentials';
  if (isLoginCallback) {
    const key = getClientKey(req);
    const rateLimit = await authLimiter.check(key);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
        }
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // CSRF / Origin Validation for API Mutations
  // Reject cross-origin POST/PATCH/PUT/DELETE requests where the
  // Origin header is present and does not match the server host.
  // Browsers always send Origin on cross-origin requests.
  // Same-origin requests either omit Origin or set it to the same host.
  // ──────────────────────────────────────────────────────────────
  const isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
  const isApiRoute = nextUrl.pathname.startsWith('/api/');
  // NextAuth's own /api/auth/* endpoints use CSRF tokens internally — skip our check.
  const isNextAuthRoute = nextUrl.pathname.startsWith('/api/auth/');

  if (isMutation && isApiRoute && !isNextAuthRoute) {
    const origin = (req.headers as Headers).get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const requestHost = getRequestHost(req);
        if (requestHost && originHost !== requestHost) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Cross-origin request rejected' } },
            { status: 403 }
          );
        }
      } catch {
        // Malformed Origin header — reject
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Invalid Origin header' } },
          { status: 403 }
        );
      }
    }
  }

  // 1. Unauthenticated users attempting to access protected routes or onboarding
  if (!isAuthenticated && (isProtectedRoute || isOnboardingRoute)) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // 2. Authenticated users attempting to access login or register
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(
      new URL(isOnboarded ? '/dashboard' : '/onboarding', nextUrl)
    );
  }

  // 3. Authenticated users with incomplete onboarding accessing workspace routes
  if (isAuthenticated && !isOnboarded && isProtectedRoute) {
    return NextResponse.redirect(new URL('/onboarding', nextUrl));
  }

  // 4. Authenticated users who have completed onboarding accessing /onboarding
  if (isAuthenticated && isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/focus/:path*',
    '/tasks/:path*',
    '/projects/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/history/:path*',
    '/onboarding/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
};
