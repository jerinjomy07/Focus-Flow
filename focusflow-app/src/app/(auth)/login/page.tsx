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
            <label
              htmlFor="password"
              className="text-xs font-medium text-foreground flex items-center justify-between"
            >
              <span>Password</span>
            </label>
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
