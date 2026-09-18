// @vitest-environment jsdom
// src/components/layout/__tests__/app-shell-a11y.test.tsx
// FocusFlow — AppShell Skip Link & Accessibility Tests (WCAG 2.4.1 Bypass Blocks)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AppShell } from '../app-shell';

// @ts-expect-error React 19 act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Alex' } }, status: 'authenticated' }),
  signOut: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { data: [] }, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe('AppShell — Bypass Blocks (WCAG 2.4.1)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  });

  it('renders skip link as the first focusable element targeting #main-content', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AppShell>
          <div id="page-body">Dashboard Content</div>
        </AppShell>
      );
    });

    const skipLink = container.querySelector('a[href="#main-content"]') as HTMLAnchorElement;
    expect(skipLink).not.toBeNull();
    expect(skipLink.textContent).toBe('Skip to main content');

    // Verify it is visually hidden by default with sr-only
    expect(skipLink.className).toContain('sr-only');
    expect(skipLink.className).toContain('focus:not-sr-only');

    // Verify the target element exists and has id="main-content"
    const mainElement = container.querySelector('main#main-content');
    expect(mainElement).not.toBeNull();
    expect(mainElement?.textContent).toContain('Dashboard Content');

    // Verify it is the first focusable child in AppShell
    const allFocusables = Array.from(
      container.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
    );
    expect(allFocusables[0]).toBe(skipLink);

    root.unmount();
  });
});
