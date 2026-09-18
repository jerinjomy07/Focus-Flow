// @vitest-environment jsdom
// src/app/(auth)/login/__tests__/login-a11y.test.tsx
// FocusFlow — Login Error Announcement Accessibility Tests (WCAG 4.1.3 Status Messages)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import LoginPage from '../page';
import * as authClient from 'next-auth/react';

// @ts-expect-error React 19 act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

describe('LoginPage — Accessibility & Error Announcement (WCAG 4.1.3)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  });

  it('announces error using role="alert" live region when submission fails', async () => {
    // Mock failed login
    vi.mocked(authClient.signIn).mockResolvedValueOnce({
      error: 'CredentialsSignin',
      code: 'credentials',
      status: 401,
      ok: false,
      url: null,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<LoginPage />);
    });

    // Before submit, no alert role should be in the DOM
    expect(container.querySelector('[role="alert"]')).toBeNull();

    const emailInput = container.querySelector('#email') as HTMLInputElement;
    const passwordInput = container.querySelector('#password') as HTMLInputElement;
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    // Fill in credentials
    await act(async () => {
      emailInput.value = 'wrong@example.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.value = 'wrongpassword';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Submit form
    await act(async () => {
      submitBtn.click();
    });

    // The error message must be present inside role="alert"
    const alertElement = container.querySelector('[role="alert"]');
    expect(alertElement).not.toBeNull();
    expect(alertElement?.textContent).toContain('Invalid email address or password. Please try again.');

    root.unmount();
  });
});
