// src/components/ui/spinner.tsx
// FocusFlow — Spinner Loading Indicator

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({
  size = 'md',
  label = 'Loading...',
  className,
  ...props
}: SpinnerProps) {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center text-primary', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeStyles[size])} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
