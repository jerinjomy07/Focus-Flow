// src/app/page.tsx
// FocusFlow — Public Landing & Marketing Shell

import Link from 'next/link';
import {
  Sparkles,
  Timer,
  CheckCircle2,
  BarChart3,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">FocusFlow</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <Button size="sm" className="font-semibold shadow-xs">
                Launch Workspace
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Zap className="h-3 w-3" />
            <span>Phase 3 Design System & Shell Online</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-[1.15]">
            Master your deep work with{' '}
            <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
              uncompromising focus.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A calm, professional productivity platform combining a timestamp-accurate Pomodoro
            engine, seamless task prioritization, and multi-tenant analytics.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto font-semibold px-8 shadow-sm">
                Enter Dashboard
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/focus" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium px-8">
                Open Focus Timer
              </Button>
            </Link>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="py-16 px-4 sm:px-6 border-t border-border/40 bg-muted/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Engineered for serious productivity
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Built without toy countdowns, fake statistics, or distracting gamification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Timer className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  Zero-Drift Timer Engine
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Remaining time is calculated mathematically against server timestamps.
                  Background tab throttling and laptop sleep will never corrupt your session.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  Task & Project Alignment
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Link focus blocks directly to actionable tasks and organizational projects.
                  Completed Pomodoro counts increment atomically.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  Real Timezone Analytics
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Streaks and daily trends are derived dynamically from verified database records
                  anchored to your local IANA timezone boundaries.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4 sm:px-6 bg-background text-muted-foreground text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">FocusFlow</span>
            <span>— Professional Pomodoro Platform</span>
          </div>
          <p>© {new Date().getFullYear()} FocusFlow. Engineered with Next.js, TypeScript & PostgreSQL.</p>
        </div>
      </footer>
    </div>
  );
}
