'use client';

// src/app/(auth)/login/page.tsx
// FocusFlow — User Login Page

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Forgot / Reset Password state
  const [isResetOpen, setIsResetOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = React.useState<string | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Please enter your account email address.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetError(null);
    setResetSuccess(null);
    setIsResetting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error?.message || 'Failed to reset password.');
        setIsResetting(false);
        return;
      }

      setResetSuccess('Password reset successfully! Signing you in...');

      // Auto sign-in
      const signInRes = await signIn('credentials', {
        email: resetEmail.trim(),
        password: newPassword,
        redirect: false,
      });

      if (signInRes?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setEmail(resetEmail);
        setPassword(newPassword);
        setIsResetOpen(false);
      }
    } catch {
      setResetError('Failed to connect to authentication server.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError('Invalid email address or password. Please try again.');
        setIsLoading(false);
        return;
      }

      // Check onboarding status
      const userRes = await fetch('/api/users/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        if (!userData.data?.onboardedAt) {
          router.push('/onboarding');
          return;
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please check your connection.');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      {isResetOpen ? (
        <form onSubmit={handleResetPassword}>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Reset Password</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your registered email address and choose a new password.
              </p>
            </div>

            {resetError && (
              <Alert variant="destructive">
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}

            {resetSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                {resetSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-xs font-medium text-foreground">
                Account Email
              </label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={isResetting}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="text-xs font-medium text-foreground">
                New Password (min 8 chars)
              </label>
              <Input
                id="reset-new-password"
                type="password"
                placeholder="••••••••"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isResetting}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="text-xs font-medium text-foreground">
                Confirm New Password
              </label>
              <Input
                id="reset-confirm-password"
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isResetting}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full font-semibold shadow-xs"
              isLoading={isResetting}
            >
              Reset Password & Sign In
            </Button>

            <button
              type="button"
              onClick={() => setIsResetOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Sign In
            </button>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-foreground flex items-center justify-between"
              >
                <span>Email Address</span>
              </label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-foreground"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetError(null);
                    setResetSuccess(null);
                    setIsResetOpen(true);
                  }}
                  className="text-xs text-primary hover:underline font-normal"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Dev Credentials Helper */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 border border-border/50">
              <p className="font-semibold text-foreground">Development Demo Accounts:</p>
              <p>Developer: <code className="text-primary font-mono">alex@focusflow.app</code> / <code className="text-primary font-mono">password123</code></p>
              <p>Student: <code className="text-primary font-mono">priya@focusflow.app</code> / <code className="text-primary font-mono">password123</code></p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full font-semibold shadow-xs"
              isLoading={isLoading}
            >
              Sign In
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12 selection:bg-primary/20 selection:text-primary">
      {/* Top right theme toggle */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/" className="flex items-center gap-2.5 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">
              FocusFlow
            </span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Sign in to your workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your focus dashboard.
          </p>
        </div>

        {/* Login Form wrapped in Suspense for useSearchParams */}
        <React.Suspense
          fallback={
            <Card className="p-6">
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                Loading login form...
              </div>
            </Card>
          }
        >
          <LoginForm />
        </React.Suspense>
      </div>
    </div>
  );
}
