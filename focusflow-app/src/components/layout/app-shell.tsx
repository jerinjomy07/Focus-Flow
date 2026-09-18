'use client';

// src/components/layout/app-shell.tsx
// FocusFlow — Primary Authenticated Application Shell
//
// WCAG 2.2 AA: Includes a "Skip to main content" bypass link (2.4.1 Bypass Blocks)
// that is visually hidden until it receives keyboard focus.

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { MobileNav } from './mobile-nav';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/*
        Skip to main content link — WCAG 2.4.1 Bypass Blocks.
        Visually hidden until focused via keyboard; becomes visible on focus
        to allow keyboard users to bypass the navigation sidebar.
      */}
      <a
        href="#main-content"
        className={cn(
          // Hidden off-screen by default
          'sr-only',
          // Revealed and visually styled when focused
          'focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
          'focus:inline-flex focus:items-center focus:px-4 focus:py-2',
          'focus:rounded-md focus:bg-primary focus:text-primary-foreground',
          'focus:text-sm focus:font-medium focus:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main
          id="main-content"
          className={cn(
            'flex-1 px-4 py-6 sm:px-6 md:px-8 max-w-7xl w-full mx-auto pb-24 md:pb-8',
            className
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
