// src/types/next-auth.d.ts
// FocusFlow — NextAuth v5 Type Augmentation

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      timezone: string;
      onboardedAt: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    timezone?: string;
    onboardedAt?: string | null;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    timezone?: string;
    onboardedAt?: string | null;
  }
}
