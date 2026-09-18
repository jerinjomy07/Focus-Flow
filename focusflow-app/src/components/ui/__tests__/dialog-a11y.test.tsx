// src/components/ui/__tests__/dialog-a11y.test.tsx
// FocusFlow — Dialog Accessibility Tests (WCAG 2.2 AA)
//
// Tests ARIA attributes and structural correctness of the Dialog component
// using SSR (renderToString) — consistent with the project's node test environment.
//
// Focus trapping and keyboard interaction require a real DOM (jsdom) and are
// covered by integration/E2E tests in Phase 12. This test verifies that the
// correct semantic foundation is in place for AT (assistive technology) to work.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Dialog, DialogTitle, DialogDescription } from '../dialog';

// Required for renderToString to work in node environment
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderHtml(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('Dialog — Structural Accessibility (WCAG 2.2 AA)', () => {
  it('does not render when open=false', () => {
    const html = renderHtml(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogTitle>Test</DialogTitle>
      </Dialog>
    );
    // Null render — no dialog in output
    expect(html).toBe('');
  });

  it('renders role="dialog" when open=true', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Test Dialog</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('role="dialog"');
  });

  it('renders aria-modal="true" when open=true', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Test Dialog</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('aria-modal="true"');
  });

  it('forwards aria-labelledby to the dialog root', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}} aria-labelledby="my-title">
        <DialogTitle id="my-title">Labelled Dialog</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('aria-labelledby="my-title"');
  });

  it('renders a close button with accessible label', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Test</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('aria-label="Close dialog"');
  });

  it('renders backdrop with aria-hidden to hide it from AT', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Test</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders tabIndex=-1 on the dialog container for focus fallback', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Test</DialogTitle>
      </Dialog>
    );
    // tabIndex -1 allows programmatic focus when no focusable children exist
    expect(html).toContain('tabindex="-1"');
  });

  it('renders DialogTitle as h2', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle id="test-title">My Title</DialogTitle>
      </Dialog>
    );
    expect(html).toContain('<h2');
    expect(html).toContain('My Title');
  });

  it('renders DialogDescription as p element', () => {
    const html = renderHtml(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>T</DialogTitle>
        <DialogDescription>Descriptive text here</DialogDescription>
      </Dialog>
    );
    expect(html).toContain('<p');
    expect(html).toContain('Descriptive text here');
  });
});
