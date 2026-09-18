'use client';

// src/components/ui/toast.tsx
// FocusFlow — Accessible Toast Notification Provider & Hook

import * as React from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'default' | 'success' | 'destructive' | 'info';
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (options: Omit<ToastMessage, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback(
    ({ title, description, type = 'default', duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, description, type, duration }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5',
              t.type === 'success' && 'border-success/30 bg-card text-card-foreground',
              t.type === 'destructive' && 'border-destructive/30 bg-card text-card-foreground',
              (t.type === 'default' || t.type === 'info') && 'border-border bg-card text-card-foreground'
            )}
          >
            {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />}
            {t.type === 'destructive' && <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            {(t.type === 'default' || t.type === 'info') && <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />}

            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-xs opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
