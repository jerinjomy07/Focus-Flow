// src/components/ui/alert.tsx
// FocusFlow — Accessible Alert Component

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export function Alert({
  className,
  variant = 'default',
  children,
  ...props
}: AlertProps) {
  const variantStyles = {
    default: 'bg-muted/50 text-foreground border-border [&>svg]:text-muted-foreground',
    destructive: 'border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive',
    success: 'border-success/30 bg-success/10 text-success [&>svg]:text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning-foreground [&>svg]:text-warning',
  };

  const icons = {
    default: <Info className="h-4 w-4 shrink-0" />,
    destructive: <AlertCircle className="h-4 w-4 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        'relative flex w-full items-start gap-3 rounded-lg border p-4 text-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icons[variant]}
      <div className="flex-1 space-y-0.5">{children}</div>
    </div>
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn('font-medium leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn('text-sm opacity-90 leading-relaxed mt-1', className)}
      {...props}
    />
  );
}
