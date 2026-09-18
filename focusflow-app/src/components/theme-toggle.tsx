'use client';

// src/components/theme-toggle.tsx
// Accessible theme switcher component

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard React 19 pattern for client mount detection without cascading setState renders
const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return (
      <div className={cn('h-8 w-24 rounded-lg bg-muted/50 animate-pulse', className)} />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5',
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        aria-label="Light mode"
        onClick={() => setTheme('light')}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
          theme === 'light' && 'bg-background text-foreground shadow-xs'
        )}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        aria-label="Dark mode"
        onClick={() => setTheme('dark')}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
          theme === 'dark' && 'bg-background text-foreground shadow-xs'
        )}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        aria-label="System mode"
        onClick={() => setTheme('system')}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
          theme === 'system' && 'bg-background text-foreground shadow-xs'
        )}
      >
        <Laptop className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
