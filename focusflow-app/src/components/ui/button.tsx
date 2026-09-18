// src/components/ui/button.tsx
// FocusFlow — Accessible Button Component

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'success'
    | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default:
        'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-[0.98]',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-xs active:scale-[0.98]',
      outline:
        'border border-border bg-background hover:bg-muted text-foreground shadow-xs active:scale-[0.98]',
      ghost:
        'hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.98]',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs active:scale-[0.98]',
      success:
        'bg-success text-success-foreground hover:bg-success/90 shadow-xs active:scale-[0.98]',
      link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
      md: 'h-9 px-4 text-sm rounded-lg gap-2',
      lg: 'h-11 px-6 text-base rounded-lg gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-lg justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
