'use client';

// src/components/session-provider.tsx
// FocusFlow — NextAuth Session Provider Client Wrapper

import * as React from 'react';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
