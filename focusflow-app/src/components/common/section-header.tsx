// src/components/common/section-header.tsx
// FocusFlow — Section Header Component

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between gap-4 mb-3', className)}
      {...props}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
