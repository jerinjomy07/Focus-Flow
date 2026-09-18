'use client';

// src/components/common/user-menu.tsx
// FocusFlow — User Profile Menu Dropdown with real session & signOut

import * as React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Settings, LogOut, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';

import { useActiveTaskStore } from '@/stores/timer-store';

export function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const displayName = session?.user?.name ?? 'Alex Miller';
  const displayEmail = session?.user?.email ?? 'alex@focusflow.app';
  const displayImage = session?.user?.image ?? null;

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    useActiveTaskStore.getState().clearSelectedTask();
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
        aria-label="User menu"
      >
        <Avatar
          src={displayImage}
          name={displayName}
          size="sm"
          className="ring-1 ring-border"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* User Details */}
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-sm font-medium leading-none text-foreground truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {displayEmail}
            </p>
          </div>

          {/* Links */}
          <div className="py-1 space-y-0.5">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link
              href="/focus"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Focus Mode
            </Link>
          </div>

          {/* Theme switcher */}
          <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>

          {/* Sign out */}
          <div className="pt-1 border-t border-border/60">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
