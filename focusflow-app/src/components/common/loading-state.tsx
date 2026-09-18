// src/components/common/loading-state.tsx
// FocusFlow — Standard Loading State Pattern

import * as React from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  variant?: 'spinner' | 'card' | 'list';
}

export function LoadingState({
  message = 'Loading...',
  variant = 'spinner',
  className,
  ...props
}: LoadingStateProps) {
  if (variant === 'card') {
    return (
      <div className={cn('space-y-3 p-6 rounded-xl border border-border bg-card', className)} {...props}>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-4 flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2.5', className)} {...props}>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        'flex min-h-[220px] flex-col items-center justify-center p-8 text-center',
        className
      )}
      {...props}
    >
      <Spinner size="lg" className="mb-3" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}
