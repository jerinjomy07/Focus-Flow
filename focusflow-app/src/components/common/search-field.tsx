'use client';

// src/components/common/search-field.tsx
// FocusFlow — Accessible Search Input Field

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className,
  ...props
}: SearchFieldProps) {
  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 py-1 text-sm shadow-xs transition-colors',
          'placeholder:text-muted-foreground/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          aria-label="Clear search input"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
