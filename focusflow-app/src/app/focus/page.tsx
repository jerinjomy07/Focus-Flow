'use client';

// src/app/focus/page.tsx
// FocusFlow — Production Pomodoro Timer Engine Interface
// Driven by pure mathematical domain logic, zero timer drift, Web Audio synthesis,
// and PostgreSQL-backed single active session concurrency protection (ADR-014, ADR-015).

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckSquare,
  Volume2,
  VolumeX,
  Bell,
  Settings,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { SessionType, UserSettings, TaskWithProject } from '@/types/domain';
import type { ActiveSessionResponse } from '@/types/api';
import {
  useTimerStore,
  useActiveTaskStore,
  TIMER_BUS_CHANNEL_NAME,
  type TimerBusMessage,
} from '@/stores/timer-store';
import { formatRemainingTime } from '@/domain/timer/calculations';
import { getNextCycleSession, getPlannedDurationSeconds } from '@/domain/timer/cycle';
import {
  playFocusCompleteChime,
  playBreakCompleteChime,
  primeAudioContext,
} from '@/lib/audio';
import { CircularProgress } from '@/components/timer/circular-progress';
import { CycleIndicator } from '@/components/timer/cycle-indicator';
import { TaskSelectModal } from '@/components/timer/task-select-modal';
import { CompletedTaskDialog } from '@/components/timer/completed-task-dialog';

export default function FocusPage() {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id;
  const queryClient = useQueryClient();

  // Stores
  const {
    snapshot,
    remainingMs,
    progressPercent,
    completedCyclesToday,
    otherTabConflict,
    setCompletedCyclesToday,
    setOtherTabConflict,
    initSession,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    resetSession,
    skipSession,
    tick,
    resetToIdle,
    syncFromSnapshot,
  } = useTimerStore();

  const {
    selectedTaskId,
    selectedProjectId,
    selectedTaskTitle,
    setSelectedTask,
    clearSelectedTask,
    syncUser,
  } = useActiveTaskStore();

  // UI Modals State
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [completedTaskDialogOpen, setCompletedTaskDialogOpen] = React.useState(false);
  const [completedTaskDetails, setCompletedTaskDetails] = React.useState<{ id: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // Sync user with active task store
  React.useEffect(() => {
    syncUser(userId ?? null);
  }, [userId, syncUser]);

  // Query Settings
  const { data: settingsData } = useQuery<{ data: UserSettings }>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const settings: Pick<
    UserSettings,
    'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'sessionsBeforeLongBreak' | 'soundEnabled' | 'notificationsEnabled' | 'autoStartBreaks' | 'autoStartFocus'
  > = React.useMemo(() => {
    const s = settingsData?.data;
    return {
      focusDuration: s?.focusDuration ?? 25,
      shortBreakDuration: s?.shortBreakDuration ?? 5,
      longBreakDuration: s?.longBreakDuration ?? 15,
      sessionsBeforeLongBreak: s?.sessionsBeforeLongBreak ?? 4,
      soundEnabled: s?.soundEnabled ?? true,
      notificationsEnabled: s?.notificationsEnabled ?? true,
      autoStartBreaks: s?.autoStartBreaks ?? false,
      autoStartFocus: s?.autoStartFocus ?? false,
    };
  }, [settingsData]);

  // Query Active Session on mount / load
  const { data: activeSessionData, isLoading: isActiveLoading } = useQuery<{ data: ActiveSessionResponse | null }>({
    queryKey: ['focus-session', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/focus-sessions/active');
      if (!res.ok) throw new Error('Failed to query active session');
      return res.json();
    },
    enabled: !!userId,
    staleTime: 0,
  });

  // Query Today's Completed Sessions Count
  const { data: historyData } = useQuery<{ meta: { total: number } }>({
    queryKey: ['focus-sessions', 'today-count'],
    queryFn: async () => {
      const res = await fetch('/api/focus-sessions?type=FOCUS&status=COMPLETED&pageSize=1');
      if (!res.ok) throw new Error('Failed to query completed count');
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  React.useEffect(() => {
    if (historyData?.meta?.total !== undefined) {
      setCompletedCyclesToday(historyData.meta.total);
    }
  }, [historyData, setCompletedCyclesToday]);

  // Initialize from Active Session or Settings
  React.useEffect(() => {
    if (!activeSessionData) return;

    if (activeSessionData.data) {
      initSession(activeSessionData.data);
      if (activeSessionData.data.taskId && activeSessionData.data.task) {
        if (userId) {
          setSelectedTask(
            userId,
            activeSessionData.data.taskId,
            activeSessionData.data.projectId,
            activeSessionData.data.task.title
          );
        }
      }
    } else {
      // If currently idle with no active session, ensure plannedDuration matches settings
      if (snapshot.state === 'IDLE' && !snapshot.sessionId) {
        const plannedDuration = getPlannedDurationSeconds(snapshot.type, settings);
        if (snapshot.plannedDurationSeconds !== plannedDuration) {
          resetToIdle(snapshot.type, plannedDuration);
        }
      }
    }
  }, [activeSessionData, initSession, resetToIdle, setSelectedTask, settings, snapshot.plannedDurationSeconds, snapshot.sessionId, snapshot.state, snapshot.type, userId]);

  // Multi-Tab BroadcastChannel synchronization
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel(TIMER_BUS_CHANNEL_NAME);
    const handleMessage = (event: MessageEvent<TimerBusMessage>) => {
      const msg = event.data;
      if (!msg || !msg.snapshot) return;

      if (msg.type === 'TIMER_STATE_SYNC' || msg.type === 'TIMER_PAUSED' || msg.type === 'TIMER_RESUMED') {
        syncFromSnapshot(msg.snapshot);
        setOtherTabConflict(true);
      } else if (msg.type === 'TIMER_COMPLETED' || msg.type === 'TIMER_ABANDONED' || msg.type === 'TIMER_SKIPPED') {
        syncFromSnapshot(msg.snapshot);
        setOtherTabConflict(false);
      } else if (msg.type === 'TIMER_IDLE') {
        syncFromSnapshot(msg.snapshot);
        setOtherTabConflict(false);
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [syncFromSnapshot, setOtherTabConflict]);

  // Tab Visibility Sync: zero drift upon sleep/wake or tab switching
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && snapshot.state === 'RUNNING') {
        tick(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [snapshot.state, tick]);

  // Natural Session Expiry Handler
  const handleNaturalExpiry = React.useCallback(async () => {
    if (!snapshot.sessionId || snapshot.state !== 'RUNNING') return;

    // Complete session on server
    try {
      await fetch(`/api/focus-sessions/${snapshot.sessionId}/complete`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to complete session on server:', err);
    }

    // Play chime
    if (snapshot.type === 'FOCUS') {
      playFocusCompleteChime(settings.soundEnabled);
    } else {
      playBreakCompleteChime(settings.soundEnabled);
    }

    completeSession();

    // Increment today's count if FOCUS
    const newCompletedCount =
      snapshot.type === 'FOCUS' ? completedCyclesToday + 1 : completedCyclesToday;
    if (snapshot.type === 'FOCUS') {
      setCompletedCyclesToday(newCompletedCount);
    }

    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

    // Determine next cycle session
    const nextSession = getNextCycleSession(
      snapshot.type,
      newCompletedCount,
      settings
    );

    // Auto-start logic or transition to IDLE
    const shouldAutoStart =
      (snapshot.type === 'FOCUS' && settings.autoStartBreaks) ||
      (snapshot.type !== 'FOCUS' && settings.autoStartFocus);

    if (shouldAutoStart) {
      // Auto-start next session
      try {
        const payload = {
          type: nextSession.nextType,
          plannedDuration: nextSession.plannedDurationSeconds,
          startedAt: new Date().toISOString(),
          taskId: nextSession.nextType === 'FOCUS' ? selectedTaskId : null,
          projectId: nextSession.nextType === 'FOCUS' ? selectedProjectId : null,
        };

        const res = await fetch('/api/focus-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const body = await res.json();
          startSession(
            body.data.id,
            body.data.type,
            body.data.plannedDuration,
            new Date(body.data.startedAt),
            body.data.task,
            body.data.project
          );
          return;
        }
      } catch (err) {
        console.error('Auto-start failed:', err);
      }
    }

    // Default to idle state with next session type
    resetToIdle(nextSession.nextType, nextSession.plannedDurationSeconds);
  }, [
    snapshot.sessionId,
    snapshot.state,
    snapshot.type,
    settings,
    completeSession,
    completedCyclesToday,
    setCompletedCyclesToday,
    queryClient,
    selectedTaskId,
    selectedProjectId,
    startSession,
    resetToIdle,
  ]);

  // 60fps RequestAnimationFrame Loop
  React.useEffect(() => {
    if (snapshot.state !== 'RUNNING') return;

    let animId: number;
    let expiredHandled = false;

    const loop = () => {
      const now = Date.now();
      tick(now);

      const storeState = useTimerStore.getState();
      if (storeState.isExpired && !expiredHandled) {
        expiredHandled = true;
        handleNaturalExpiry();
        return;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [snapshot.state, tick, handleNaturalExpiry]);

  // Actions
  const handleSelectMode = (type: SessionType) => {
    if (snapshot.state !== 'IDLE') return;
    const duration = getPlannedDurationSeconds(type, settings);
    resetToIdle(type, duration);
  };

  const handleStart = async () => {
    setIsSubmitting(true);
    setApiError(null);
    primeAudioContext();

    try {
      const payload = {
        type: snapshot.type,
        plannedDuration: snapshot.plannedDurationSeconds,
        startedAt: new Date().toISOString(),
        taskId: snapshot.type === 'FOCUS' ? selectedTaskId : null,
        projectId: snapshot.type === 'FOCUS' ? selectedProjectId : null,
      };

      const res = await fetch('/api/focus-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok) {
        if (res.status === 409 && body?.error?.code === 'ACTIVE_SESSION_EXISTS') {
          // Recover active session from conflict
          if (body.error.activeSession) {
            initSession(body.error.activeSession);
            setOtherTabConflict(true);
            return;
          }
        }

        if (res.status === 400 && body?.error?.details) {
          const completedTaskIssue = body.error.details.find(
            (d: { field: string; issue: string }) => d.issue === 'TASK_IS_COMPLETED'
          );
          if (completedTaskIssue && selectedTaskId && selectedTaskTitle) {
            setCompletedTaskDetails({ id: selectedTaskId, title: selectedTaskTitle });
            setCompletedTaskDialogOpen(true);
            return;
          }
        }

        throw new Error(body?.error?.message || 'Failed to start session');
      }

      startSession(
        body.data.id,
        body.data.type,
        body.data.plannedDuration,
        new Date(body.data.startedAt),
        body.data.task,
        body.data.project
      );
      setOtherTabConflict(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    if (!snapshot.sessionId) return;
    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/focus-sessions/${snapshot.sessionId}/pause`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Failed to pause session');
      }
      pauseSession(new Date());
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to pause session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResume = async () => {
    if (!snapshot.sessionId) return;
    setIsSubmitting(true);
    setApiError(null);
    primeAudioContext();

    try {
      const res = await fetch(`/api/focus-sessions/${snapshot.sessionId}/resume`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Failed to resume session');
      }
      resumeSession(new Date());
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to resume session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!snapshot.sessionId) {
      const duration = getPlannedDurationSeconds(snapshot.type, settings);
      resetToIdle(snapshot.type, duration);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/focus-sessions/${snapshot.sessionId}/reset`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Failed to reset session');
      }
      resetSession();
      const duration = getPlannedDurationSeconds(snapshot.type, settings);
      resetToIdle(snapshot.type, duration);
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to reset session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (snapshot.sessionId) {
      setIsSubmitting(true);
      setApiError(null);

      try {
        await fetch(`/api/focus-sessions/${snapshot.sessionId}/skip`, {
          method: 'POST',
        });
        skipSession();
      } catch (err) {
        console.error('Failed to skip session on server:', err);
      } finally {
        setIsSubmitting(false);
      }
    }

    // Advance to next cycle phase
    const nextSession = getNextCycleSession(
      snapshot.type,
      completedCyclesToday,
      settings
    );
    resetToIdle(nextSession.nextType, nextSession.plannedDurationSeconds);
    queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] });
  };

  // Keyboard Shortcuts (<kbd>Space</kbd>, <kbd>R</kbd>, <kbd>S</kbd>)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        taskModalOpen ||
        completedTaskDialogOpen
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (snapshot.state === 'IDLE') {
          handleStart();
        } else if (snapshot.state === 'RUNNING') {
          handlePause();
        } else if (snapshot.state === 'PAUSED') {
          handleResume();
        }
      } else if (e.code === 'KeyR' && (snapshot.state === 'RUNNING' || snapshot.state === 'PAUSED')) {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'KeyS' && (snapshot.state === 'RUNNING' || snapshot.state === 'PAUSED' || snapshot.state === 'IDLE')) {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const displayTime = formatRemainingTime(remainingMs).formatted;

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] max-w-2xl mx-auto py-6 text-center px-4">
        {/* Multi-Tab Conflict Notification Banner */}
        {otherTabConflict && (
          <div className="w-full mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-left">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>A focus session is currently running in another browser tab. State is being synchronized.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] })}
              className="shrink-0 gap-1 text-xs h-7 px-2"
            >
              <RefreshCw className="h-3 w-3" /> Sync
            </Button>
          </div>
        )}

        {/* API Error Notification */}
        {apiError && (
          <div className="w-full mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center justify-between gap-3">
            <span>{apiError}</span>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setApiError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Session Type Segmented Controls */}
        <div
          role="tablist"
          aria-label="Timer session modes"
          className="inline-flex items-center rounded-xl bg-muted/60 p-1 border border-border/60 mb-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={snapshot.type === 'FOCUS'}
            disabled={snapshot.state !== 'IDLE'}
            onClick={() => handleSelectMode('FOCUS')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
              snapshot.type === 'FOCUS'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Focus ({settings.focusDuration}m)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={snapshot.type === 'SHORT_BREAK'}
            disabled={snapshot.state !== 'IDLE'}
            onClick={() => handleSelectMode('SHORT_BREAK')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
              snapshot.type === 'SHORT_BREAK'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Short Break ({settings.shortBreakDuration}m)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={snapshot.type === 'LONG_BREAK'}
            disabled={snapshot.state !== 'IDLE'}
            onClick={() => handleSelectMode('LONG_BREAK')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
              snapshot.type === 'LONG_BREAK'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Long Break ({settings.longBreakDuration}m)
          </button>
        </div>

        {/* Active Task Link Pill */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors shadow-2xs cursor-pointer max-w-sm sm:max-w-md truncate"
            title="Click to select or change active task"
          >
            <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
            {selectedTaskTitle ? (
              <span className="truncate font-medium text-foreground">
                Working on: {selectedTaskTitle}
              </span>
            ) : (
              <span>Select a task to link with this session</span>
            )}
          </button>
        </div>

        {/* SVG Circular Progress Ring with Monospace Countdown */}
        <div className="my-2">
          {isActiveLoading ? (
            <div className="h-[300px] w-[300px] flex items-center justify-center">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
          ) : (
            <CircularProgress
              progressPercent={progressPercent}
              timeFormatted={displayTime}
              sessionType={snapshot.type}
              timerState={snapshot.state}
              size={300}
            />
          )}
        </div>

        {/* Cycle Progression Indicator */}
        <div className="my-6">
          <CycleIndicator
            completedTodayCount={completedCyclesToday}
            sessionsBeforeLongBreak={settings.sessionsBeforeLongBreak}
            currentType={snapshot.type}
            timerState={snapshot.state}
          />
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-center gap-3 mt-2">
          {snapshot.state === 'IDLE' ? (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={isSubmitting}
              className="h-12 px-8 text-base font-semibold shadow-md gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              {snapshot.type === 'FOCUS' ? 'Start Focus' : 'Start Break'}
            </Button>
          ) : snapshot.state === 'RUNNING' ? (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={handlePause}
                disabled={isSubmitting}
                className="h-12 px-6 gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4 fill-current" />
                )}
                Pause
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleReset}
                disabled={isSubmitting}
                className="h-12 px-4 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
            </>
          ) : snapshot.state === 'PAUSED' ? (
            <>
              <Button
                size="lg"
                onClick={handleResume}
                disabled={isSubmitting}
                className="h-12 px-8 gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                Resume
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleReset}
                disabled={isSubmitting}
                className="h-12 px-4 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={isSubmitting}
              className="h-12 px-8 gap-2 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Start Next
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkip}
            disabled={isSubmitting}
            title="Skip session (advance cycle) [S]"
            className="text-muted-foreground hover:text-foreground cursor-pointer h-12 w-12"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Keyboard Shortcuts Hint & Utilities Footer */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {settings.soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            Chime {settings.soundEnabled ? 'On' : 'Off'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications {settings.notificationsEnabled ? 'On' : 'Off'}
          </span>
          <span>•</span>
          <span className="hidden sm:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-2xs bg-muted border border-border rounded">Space</kbd> Play/Pause
          </span>
          <span className="hidden sm:inline">•</span>
          <Link href="/settings" className="hover:underline flex items-center gap-1">
            <Settings className="h-3.5 w-3.5" /> Customize
          </Link>
        </div>
      </div>

      {/* Task Select Modal */}
      <TaskSelectModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        selectedTaskId={selectedTaskId}
        onSelectTask={(task: TaskWithProject | null) => {
          if (!task) {
            clearSelectedTask();
          } else if (userId) {
            setSelectedTask(userId, task.id, task.projectId, task.title);
          }
        }}
      />

      {/* Completed Task Warning Dialog */}
      {completedTaskDetails && (
        <CompletedTaskDialog
          open={completedTaskDialogOpen}
          onOpenChange={setCompletedTaskDialogOpen}
          taskId={completedTaskDetails.id}
          taskTitle={completedTaskDetails.title}
          onReopened={() => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            handleStart();
          }}
        />
      )}
    </AppShell>
  );
}
