'use client';

// src/components/ui/checkbox.tsx
// FocusFlow — Accessible Checkbox Component

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          onCheckedChange(!checked);
        }
      }}
      className={cn(
        'peer h-4 w-4 shrink-0 rounded border border-primary/50 ring-offset-background transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center justify-center',
        checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:border-primary',
        className
      )}
    >
      {checked && <Check className="h-3 w-3 stroke-[3]" />}
    </button>
  );
}
