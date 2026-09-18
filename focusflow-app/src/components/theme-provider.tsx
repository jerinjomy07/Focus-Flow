'use client';

// src/components/theme-provider.tsx
// FocusFlow — Accessible Theme Provider supporting Light, Dark, and System modes.

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
