'use client';

// src/components/layout/header.tsx
// FocusFlow — Top Application Header

import * as React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { SearchField } from '@/components/common/search-field';
import { NotificationCenter } from '@/components/common/notification-center';
import { UserMenu } from '@/components/common/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export function Header({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 sm:px-6 backdrop-blur-md',
        className
      )}
    >
      {/* Mobile Logo (hidden on desktop where sidebar has logo) */}
      <div className="flex items-center gap-2.5 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            FocusFlow
          </span>
        </Link>
      </div>

      {/* Global Search Bar (Desktop) */}
      <div className="hidden sm:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search tasks, projects, notes... (Press ⌘K)"
            className="w-full max-w-md"
          />
        </div>
      </div>

      {/* Right Action Icons: Theme, Notifications, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <NotificationCenter />
        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
