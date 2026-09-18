// src/lib/auth/index.ts
// FocusFlow — Auth.js v5 (NextAuth) Core Configuration
// Implements bcrypt credential verification, JWT token enrichment,
// and session callbacks for multi-tenant identity.

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/client';
import { LoginSchema } from '@/lib/validations';

const nextAuthResult = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days sliding session
  },
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            image: true,
            timezone: true,
            onboardedAt: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          timezone: user.timezone,
          onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial login, copy user properties to token
      if (user) {
        token.id = user.id;
        token.timezone = (user as unknown as { timezone?: string }).timezone ?? 'UTC';
        token.onboardedAt = (user as unknown as { onboardedAt?: string | null }).onboardedAt ?? null;
      }

      // Handle session updates (e.g. after onboarding completion)
      if (trigger === 'update' && session) {
        if (session.user?.name !== undefined) token.name = session.user.name;
        if (session.user?.timezone !== undefined) token.timezone = session.user.timezone;
        if (session.user?.onboardedAt !== undefined) token.onboardedAt = session.user.onboardedAt;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.timezone = (token.timezone as string) ?? 'UTC';
        session.user.onboardedAt = (token.onboardedAt as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});

export const { handlers, signIn, signOut } = nextAuthResult;
const rawAuth = nextAuthResult.auth;

/**
 * Universal auth helper supporting both:
 * 1. Web browser sessions (via HttpOnly session cookies)
 * 2. Mobile client sessions (via Authorization: Bearer <jwt> headers)
 *
 * Middleware pass-through signature is preserved identically.
 */
export const auth: typeof rawAuth = ((...args: unknown[]) => {
  // If invoked with middleware arguments (e.g. auth(async (req) => { ... })), delegate directly to rawAuth
  if (args.length > 0) {
    return (rawAuth as (...a: unknown[]) => unknown)(...args);
  }

  return (async () => {
    // 1. Check for web browser cookie session first
    try {
      const webSession = await (rawAuth as () => Promise<{ user?: { id?: string } } | null>)();
      if (webSession?.user?.id) {
        return webSession;
      }
    } catch {
      // Non-request context or headers inaccessible
    }

  // 2. Check for Authorization: Bearer <token> for mobile / API clients
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const { verifyMobileAccessToken } = await import('./mobileTokens');
        const mobilePayload = verifyMobileAccessToken(token);

        if (mobilePayload) {
          // Verify session is active in database and not revoked
          const sessionRecord = await prisma.mobileSession.findUnique({
            where: { id: mobilePayload.sid },
            include: { user: true },
          });

          if (
            sessionRecord &&
            !sessionRecord.revokedAt &&
            sessionRecord.expiresAt > new Date()
          ) {
            const user = sessionRecord.user;
            return {
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                timezone: user.timezone,
                onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
              },
              expires: new Date(mobilePayload.exp * 1000).toISOString(),
            };
          }
        }
      }
    }
  } catch {
    // headers() or DB inaccessible
  }

    return null;
  })();
}) as unknown as typeof rawAuth;

