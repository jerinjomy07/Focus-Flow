'use client';

// src/components/timer/completed-task-dialog.tsx
// FocusFlow — Completed Task Guard Dialog
// Prevents focusing on completed tasks and offers explicit reopen workflow (ADR-013/ADR-014)

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface CompletedTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskId: string;
  onReopened: () => void;
}

export function CompletedTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  taskId,
  onReopened,
}: CompletedTaskDialogProps) {
  const [isReopening, setIsReopening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleReopen = async () => {
    setIsReopening(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reopen`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Failed to reopen task');
      }
      onReopened();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen task');
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-5 w-5" />
          <DialogTitle>Task is Already Completed</DialogTitle>
        </div>
        <DialogDescription>
          You cannot start a focus session on &ldquo;<span className="font-semibold text-foreground">{taskTitle}</span>&rdquo; because it is marked as completed.
        </DialogDescription>
      </DialogHeader>

      <div className="py-3 text-sm text-muted-foreground">
        Would you like to reopen this task to continue working on it, or choose a different task?
        {error && (
          <p className="mt-2 text-xs text-destructive font-medium">{error}</p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isReopening}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleReopen}
          disabled={isReopening}
          className="gap-1.5"
        >
          {isReopening ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reopen Task
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
