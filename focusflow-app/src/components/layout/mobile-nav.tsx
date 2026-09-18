'use client';

// src/components/layout/mobile-nav.tsx
// FocusFlow — Mobile Bottom Navigation Bar
// Designed with 48px+ touch targets and clear active states.

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Timer,
  CheckSquare,
  FolderKanban,
  History,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  const items = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Focus', href: '/focus', icon: Timer },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'History', href: '/history', icon: History },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur-lg md:hidden shadow-lg',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-lg transition-colors',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn('relative p-1 rounded-md', isActive && 'bg-primary/10')}>
              <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
