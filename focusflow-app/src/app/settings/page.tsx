'use client';

// src/app/settings/page.tsx
// FocusFlow — User Settings & Preferences Page (Phase 10)
//
// Manages:
// 1. Authoritative IANA Timezone selection (User.timezone)
// 2. In-App Notification Preferences (NotificationPreference.focusSessionCompletion)
// 3. Pomodoro Timer Durations & Autostart rules (UserSettings)
// 4. Interface Theme (Appearance)

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Bell,
  Timer,
  Palette,
  Save,
  Loader2,
  Info,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { queryKeys } from '@/lib/query-keys';
import type { UserSettings } from '@/types/domain';

// Common IANA timezones list for friendly UX
const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New York (Eastern Time - US & Canada)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central Time - US & Canada)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain Time - US & Canada)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (Pacific Time - US & Canada)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (Alaska)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (Hawaii)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (Brasilia Time)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST - UK)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST - France)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST - Germany)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST - Netherlands)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST - Switzerland)' },
  { value: 'Europe/Athens', label: 'Europe/Athens (EET/EEST - Greece)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (Egypt Standard Time)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (South Africa Standard Time)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (Gulf Standard Time)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (India Standard Time)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (Singapore Standard Time)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (Hong Kong Time)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan Standard Time)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (Korea Standard Time)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT - Sydney, Melbourne)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST - Western Australia)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT - New Zealand)' },
];

interface SettingsFormProps {
  initialSettings: UserSettings & { timezone?: string };
  initialNotifPref: { focusSessionCompletion: boolean };
}

function SettingsForm({ initialSettings, initialNotifPref }: SettingsFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Local form state initialized directly from loaded server data
  const [timezone, setTimezone] = React.useState(initialSettings.timezone ?? 'UTC');
  const [focusSessionCompletion, setFocusSessionCompletion] = React.useState(
    initialNotifPref.focusSessionCompletion
  );
  const [focusDuration, setFocusDuration] = React.useState(
    initialSettings.focusDuration ?? 25
  );
  const [shortBreakDuration, setShortBreakDuration] = React.useState(
    initialSettings.shortBreakDuration ?? 5
  );
  const [longBreakDuration, setLongBreakDuration] = React.useState(
    initialSettings.longBreakDuration ?? 15
  );
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = React.useState(
    initialSettings.sessionsBeforeLongBreak ?? 4
  );
  const [autoStartBreaks, setAutoStartBreaks] = React.useState(
    initialSettings.autoStartBreaks ?? false
  );
  const [autoStartFocus, setAutoStartFocus] = React.useState(
    initialSettings.autoStartFocus ?? false
  );

  // Mutation to persist settings and preferences
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update settings (including timezone)
      const settingsRes = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          focusDuration,
          shortBreakDuration,
          longBreakDuration,
          sessionsBeforeLongBreak,
          autoStartBreaks,
          autoStartFocus,
        }),
      });

      if (!settingsRes.ok) {
        const errorData = await settingsRes.json();
        throw new Error(errorData?.error?.message || 'Failed to update settings');
      }

      // 2. Update notification preferences
      const notifRes = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusSessionCompletion,
        }),
      });

      if (!notifRes.ok) {
        const errorData = await notifRes.json();
        throw new Error(errorData?.error?.message || 'Failed to update notification preferences');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.productivity.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.summary('today') });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });

      toast({
        title: 'Settings Saved',
        description: 'Your preferences have been updated successfully.',
        type: 'success',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Error Saving Settings',
        description: err.message || 'An unexpected error occurred while saving your preferences.',
        type: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  // Ensure current timezone is always in the options list
  const timezoneOptions = React.useMemo(() => {
    if (!COMMON_TIMEZONES.some((tz) => tz.value === timezone)) {
      return [{ value: timezone, label: `${timezone} (Current)` }, ...COMMON_TIMEZONES];
    }
    return COMMON_TIMEZONES;
  }, [timezone]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Configure your timezone, in-app notification preferences, and Pomodoro timer durations."
      >
        <Button
          onClick={handleSave}
          size="sm"
          disabled={saveMutation.isPending}
          aria-label="Save Settings Changes"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Changes
        </Button>
      </PageHeader>

      {/* 1. General Section (Timezone Authority) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">General</CardTitle>
          </div>
          <CardDescription>
            Timezone determines your midnight boundaries for streak calculations, daily goals, and productivity summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-md">
            <label htmlFor="user-timezone" className="text-xs font-medium text-foreground">
              Timezone (IANA)
            </label>
            <Select
              id="user-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="Select your IANA timezone"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p className="leading-relaxed">
              Changing your timezone updates local date boundaries for session history, dashboard ranges, and analytics. Existing session timestamps are preserved as absolute UTC instants.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Notifications Section (In-App Only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure in-app notification alerts for timer lifecycle events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Focus Session Completion</p>
              <p className="text-xs text-muted-foreground">
                Receive an in-app notification when a focus session countdown finishes.
              </p>
            </div>
            <Switch
              checked={focusSessionCompletion}
              onCheckedChange={setFocusSessionCompletion}
              aria-label="Toggle focus session completion notifications"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p className="leading-relaxed">
              FocusFlow delivers persistent in-app notifications via the Notification Center bell in the top navigation bar. Browser push and email notifications are not enabled in this version.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Timer Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Timer Durations</CardTitle>
          </div>
          <CardDescription>
            Customize interval durations in minutes. Standard Pomodoro is 25m focus, 5m short break, 15m long break.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="focus-dur" className="text-xs font-medium text-foreground">
                Focus Duration (min)
              </label>
              <Input
                id="focus-dur"
                type="number"
                min="1"
                max="120"
                value={focusDuration}
                onChange={(e) => setFocusDuration(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="short-break" className="text-xs font-medium text-foreground">
                Short Break (min)
              </label>
              <Input
                id="short-break"
                type="number"
                min="1"
                max="60"
                value={shortBreakDuration}
                onChange={(e) => setShortBreakDuration(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="long-break" className="text-xs font-medium text-foreground">
                Long Break (min)
              </label>
              <Input
                id="long-break"
                type="number"
                min="1"
                max="120"
                value={longBreakDuration}
                onChange={(e) => setLongBreakDuration(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cycle-count" className="text-xs font-medium text-foreground">
                Sessions Before Long Break
              </label>
              <Input
                id="cycle-count"
                type="number"
                min="1"
                max="10"
                value={sessionsBeforeLongBreak}
                onChange={(e) => setSessionsBeforeLongBreak(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-start Breaks</p>
                <p className="text-xs text-muted-foreground">
                  Automatically initiate break countdown when a focus block expires.
                </p>
              </div>
              <Switch
                checked={autoStartBreaks}
                onCheckedChange={setAutoStartBreaks}
                aria-label="Toggle auto-start breaks"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-start Focus</p>
                <p className="text-xs text-muted-foreground">
                  Automatically initiate the next focus block when a break completes.
                </p>
              </div>
              <Switch
                checked={autoStartFocus}
                onCheckedChange={setAutoStartFocus}
                aria-label="Toggle auto-start focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Appearance Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Appearance</CardTitle>
          </div>
          <CardDescription>
            Choose light mode, dark mode, or follow your operating system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Interface Theme</p>
            <p className="text-xs text-muted-foreground">
              High-contrast, eye-strain-reducing color scheme.
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const {
    data: settingsData,
    isLoading: isSettingsLoading,
    error: settingsError,
  } = useQuery<{ data: UserSettings & { timezone?: string } }>({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
  });

  const {
    data: notifPrefData,
    isLoading: isNotifPrefLoading,
    error: notifPrefError,
  } = useQuery<{ data: { focusSessionCompletion: boolean } }>({
    queryKey: queryKeys.notificationPreferences,
    queryFn: async () => {
      const res = await fetch('/api/notification-preferences');
      if (!res.ok) throw new Error('Failed to load notification preferences');
      return res.json();
    },
  });

  const isLoading = isSettingsLoading || isNotifPrefLoading;
  const isError = Boolean(settingsError || notifPrefError);

  return (
    <AppShell>
      {isLoading ? (
        <div className="space-y-6 max-w-4xl">
          <PageHeader
            title="Settings"
            description="Configure your timezone, in-app notification preferences, and Pomodoro timer durations."
          />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : isError || !settingsData?.data || !notifPrefData?.data ? (
        <div className="space-y-6 max-w-4xl">
          <PageHeader
            title="Settings"
            description="Configure your timezone, in-app notification preferences, and Pomodoro timer durations."
          />
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load your settings. Please refresh the page or try again later.
          </div>
        </div>
      ) : (
        <SettingsForm
          initialSettings={settingsData.data}
          initialNotifPref={notifPrefData.data}
        />
      )}
    </AppShell>
  );
}