'use client';

// src/app/onboarding/page.tsx
// FocusFlow — First-Time User Onboarding Wizard
// Multi-step onboarding: Timezone detection, timer durations, daily goals, initial project/task.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();

  const [step, setStep] = React.useState(1);
  const totalSteps = 4;

  // Auto-detect browser timezone via useSyncExternalStore
  const detectedTimezone = React.useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        return 'UTC';
      }
    },
    () => 'UTC'
  );

  // Onboarding Form State
  const [selectedTimezone, setSelectedTimezone] = React.useState<string | null>(null);
  const timezone = selectedTimezone ?? detectedTimezone;
  const setTimezone = (tz: string) => setSelectedTimezone(tz);

  const [focusDuration, setFocusDuration] = React.useState(25);
  const [shortBreakDuration, setShortBreakDuration] = React.useState(5);
  const [longBreakDuration, setLongBreakDuration] = React.useState(15);
  const [dailyGoal, setDailyGoal] = React.useState(4);
  const [firstProjectName, setFirstProjectName] = React.useState('FocusFlow Platform');
  const [firstTaskTitle, setFirstTaskTitle] = React.useState('Complete my first focus session');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          focusDuration,
          shortBreakDuration,
          longBreakDuration,
          dailyGoal,
          firstProjectName,
          firstTaskTitle,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Update client session token with new onboardedAt
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          timezone,
          onboardedAt: new Date().toISOString(),
        },
      });

      toast({
        title: 'Welcome to FocusFlow!',
        description: 'Your workspace is configured and ready for deep work.',
        type: 'success',
      });

      router.push('/dashboard');
      router.refresh();
    } catch {
      toast({
        title: 'Submission Error',
        description: 'Could not complete onboarding. Please try again.',
        type: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 selection:bg-primary/20 selection:text-primary">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Progress header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
            <Zap className="h-3 w-3" />
            <span>Workspace Setup</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {step === 1 && 'Confirm your Timezone'}
            {step === 2 && 'Timer Preferences'}
            {step === 3 && 'Daily Productivity Goal'}
            {step === 4 && 'Create Your First Task'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress value={progressPercent} max={100} className="h-1.5" />
        </div>

        {/* Step Card */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            {/* STEP 1: Timezone */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Clock className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">Why timezone matters</p>
                    <p className="text-muted-foreground mt-0.5">
                      FocusFlow uses your timezone to calculate daily streaks and reset midnight productivity boundaries accurately.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="timezone-select" className="text-xs font-medium text-foreground">
                    Detected Local Timezone
                  </label>
                  <Select
                    id="timezone-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="America/New_York">America/New_York (UTC-4 / EDT)</option>
                    <option value="America/Chicago">America/Chicago (UTC-5 / CDT)</option>
                    <option value="America/Denver">America/Denver (UTC-6 / MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-7 / PDT)</option>
                    <option value="Europe/London">Europe/London (UTC+1 / BST)</option>
                    <option value="Europe/Paris">Europe/Paris (UTC+2 / CEST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30 / IST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8 / SGT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9 / JST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (UTC+10 / AEST)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                  </Select>
                </div>
              </div>
            )}

            {/* STEP 2: Timer Settings */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <p className="text-xs text-muted-foreground">
                  FocusFlow follows the classic Pomodoro framework by default: 25 minutes of deep focus followed by a 5-minute break.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="focus-min" className="text-xs font-medium text-foreground">
                      Focus (min)
                    </label>
                    <Input
                      id="focus-min"
                      type="number"
                      min="1"
                      max="120"
                      value={focusDuration}
                      onChange={(e) => setFocusDuration(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="short-min" className="text-xs font-medium text-foreground">
                      Short Break (min)
                    </label>
                    <Input
                      id="short-min"
                      type="number"
                      min="1"
                      max="60"
                      value={shortBreakDuration}
                      onChange={(e) => setShortBreakDuration(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="long-min" className="text-xs font-medium text-foreground">
                      Long Break (min)
                    </label>
                    <Input
                      id="long-min"
                      type="number"
                      min="1"
                      max="120"
                      value={longBreakDuration}
                      onChange={(e) => setLongBreakDuration(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Daily Goal */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <p className="text-xs text-muted-foreground">
                  Set a daily Pomodoro target to build sustainable focus habits and streak momentum.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[2, 4, 6].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setDailyGoal(count)}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer',
                        dailyGoal === count
                          ? 'border-primary bg-primary/10 text-primary shadow-xs'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-xs mt-1">Pomodoros</span>
                      <span className="text-[10px] text-muted-foreground">({count * 25}m)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: First Task & Project */}
            {step === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <p className="text-xs text-muted-foreground">
                  Give your workspace an initial structure by naming your primary project and first focus task.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="project-name" className="text-xs font-medium text-foreground">
                    Project Name
                  </label>
                  <Input
                    id="project-name"
                    value={firstProjectName}
                    onChange={(e) => setFirstProjectName(e.target.value)}
                    placeholder="e.g. FocusFlow Platform"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-title" className="text-xs font-medium text-foreground">
                    First Task
                  </label>
                  <Input
                    id="task-title"
                    value={firstTaskTitle}
                    onChange={(e) => setFirstTaskTitle(e.target.value)}
                    placeholder="e.g. Complete first 25-minute Pomodoro"
                  />
                </div>
              </div>
            )}
          </CardContent>

          {/* Navigation Buttons */}
          <CardFooter className="flex items-center justify-between border-t border-border/60 pt-4">
            {step > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                isLoading={isSubmitting}
                onClick={handleComplete}
                className="font-semibold shadow-xs"
              >
                Finish & Enter Workspace
                <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
