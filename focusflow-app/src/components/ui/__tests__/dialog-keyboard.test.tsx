// @vitest-environment jsdom
// src/components/ui/__tests__/dialog-keyboard.test.tsx
// FocusFlow — Dialog Keyboard Navigation & Focus Management Tests (WCAG 2.2 AA)

import React, { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Dialog, DialogTitle, DialogFooter } from '../dialog';
import { Button } from '../button';

// @ts-expect-error React 19 act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Dialog Keyboard Navigation (DOM / jsdom)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  });

  function DialogTestHarness() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button id="open-btn" onClick={() => setOpen(true)}>
          Open Dialog
        </button>
        <Dialog open={open} onOpenChange={setOpen} aria-labelledby="dialog-title">
          <DialogTitle id="dialog-title">Confirm Delete Project</DialogTitle>
          <input id="test-input" placeholder="Project name" />
          <DialogFooter>
            <Button id="cancel-btn" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button id="confirm-btn" variant="destructive" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    );
  }

  it('traps Tab navigation and wraps from last focusable to first focusable', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<DialogTestHarness />);
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    openBtn.focus();
    expect(document.activeElement).toBe(openBtn);

    // Open the dialog
    await act(async () => {
      openBtn.click();
    });

    // Wait for rAF focus
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const closeBtn = document.querySelector('button[aria-label="Close dialog"]') as HTMLButtonElement;
    const confirmBtn = document.querySelector('#confirm-btn') as HTMLButtonElement;

    expect(closeBtn).toBeDefined();
    expect(confirmBtn).toBeDefined();

    // Set focus to the last element (confirmBtn)
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    // Press Tab on the last element -> should wrap to closeBtn
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);

    expect(document.activeElement).toBe(closeBtn);

    // Now on first element (closeBtn), press Shift+Tab -> should wrap to confirmBtn
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(shiftTabEvent);

    expect(document.activeElement).toBe(confirmBtn);

    root.unmount();
  });

  it('dismisses dialog on Escape key and restores focus to the trigger button', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<DialogTestHarness />);
    });

    const openBtn = container.querySelector('#open-btn') as HTMLButtonElement;
    openBtn.focus();
    expect(document.activeElement).toBe(openBtn);

    // Open dialog
    await act(async () => {
      openBtn.click();
    });

    // Wait for focus transfer
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // Press Escape
    await act(async () => {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(escapeEvent);
    });

    // Dialog should be closed
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // Focus should be returned to the open button
    expect(document.activeElement).toBe(openBtn);

    root.unmount();
  });
});
