'use client';

// src/components/ui/dialog.tsx
// FocusFlow — Accessible Modal Dialog Component
//
// WCAG 2.2 AA compliance:
//  - Focus trap: Tab / Shift+Tab cycles within focusable dialog descendants (2.1.2)
//  - Return focus: Restores focus to the triggering element on close (2.4.3)
//  - aria-modal, role="dialog", aria-labelledby support (4.1.2)
//  - Backdrop scroll lock
//  - Escape key dismissal

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Selects all interactive elements that can receive keyboard focus */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** ID of an element (e.g. DialogTitle) that labels this dialog */
  'aria-labelledby'?: string;
}

export function Dialog({ open, onOpenChange, children, 'aria-labelledby': labelledBy }: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  /** Saves the element that had focus before the dialog opened */
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Save the currently focused element when the dialog opens,
  // and move focus into the dialog.
  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Move focus to the first focusable element inside the dialog,
      // or fall back to the dialog container itself.
      const frame = requestAnimationFrame(() => {
        if (!dialogRef.current) return;
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          dialogRef.current.focus();
        }
      });
      return () => cancelAnimationFrame(frame);
    } else {
      // Restore focus to the element that was active before the dialog opened
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [open]);

  // Focus trap: intercept Tab and Shift+Tab to cycle within dialog
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }

      if (event.key !== 'Tab') return;
      if (!dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if focus is at the first element, wrap to last
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is at the last element, wrap to first
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Prevent background scrolling when dialog is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 outline-none"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground mt-1', className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6',
        className
      )}
      {...props}
    />
  );
}
