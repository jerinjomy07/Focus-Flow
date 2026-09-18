'use client';

// src/components/common/notification-center.tsx
// FocusFlow — Notification Center UI Component (Phase 10)
// Features:
// - Live unread notification count badge (hidden when 0)
// - TanStack Query integration with queryKeys.notifications.all
// - Idempotent mark-as-read and mark-all-as-read mutations
// - Relative timestamp formatting and empty/loading/error states
// - Accessible popover with outside click and Escape dismissal

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Sparkles, Timer, CheckCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { NotificationListResponse, NotificationResponse } from '@/types/api';

/**
 * Deterministic relative time formatter for notification timestamps.
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function NotificationCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 1. Fetch notifications (top 20 newest)
  const { data, isLoading, isError, refetch } = useQuery<NotificationListResponse>({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const res = await fetch('/api/notifications?page=1&pageSize=20');
      if (!res.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta?.unreadCount ?? 0;

  // 2. Mark single notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // 3. Mark all notifications as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // Click outside listener
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escape key listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Notification item click handler
  const handleItemClick = (notification: NotificationResponse) => {
    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }
    setIsOpen(false);
    if (notification.metadata && notification.metadata.focusSessionId) {
      router.push('/history');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in duration-150"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card text-card-foreground shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
              {unreadCount > 0 ? (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {unreadCount} unread
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">All caught up</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              {markAllReadMutation.isPending ? (
                <Spinner className="h-3 w-3 mr-1" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
              )}
              Mark all read
            </Button>
          </div>

          {/* Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
            {isLoading && (
              <div className="p-4 space-y-3" data-testid="notifications-loading">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="p-6 text-center" data-testid="notifications-error">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-3">Failed to load notifications</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  className="text-xs h-7"
                >
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <div className="py-10 px-4 text-center" data-testid="notifications-empty">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
                  When you complete focus sessions, your notifications will appear here.
                </p>
              </div>
            )}

            {!isLoading &&
              !isError &&
              notifications.map((notification) => {
                const isUnread = !notification.readAt;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleItemClick(notification)}
                    className={cn(
                      'w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50',
                      isUnread && 'bg-primary/5 dark:bg-primary/10'
                    )}
                  >
                    {/* Icon Badge */}
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        isUnread
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {notification.type === 'FOCUS_SESSION_COMPLETED' ? (
                        <Timer className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'text-xs truncate',
                            isUnread
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-foreground/80'
                          )}
                        >
                          {notification.title}
                        </p>
                        {isUnread && (
                          <span
                            aria-label="Unread"
                            className="h-2 w-2 rounded-full bg-primary shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {notification.body}
                      </p>
                      <span className="inline-block text-[10px] text-muted-foreground/70">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
