// src/components/ui/__tests__/responsive-layouts.test.tsx
// FocusFlow — Responsive Layout Verification for Hardened Components

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Dialog, DialogFooter, DialogTitle } from '../dialog';

describe('Responsive Layout Attributes on Hardened Components', () => {
  it('Dialog uses mobile-first responsive padding and max-width constraints', () => {
    const html = renderToString(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTitle>Responsive Dialog</DialogTitle>
        <DialogFooter>
          <button>Cancel</button>
          <button>Confirm</button>
        </DialogFooter>
      </Dialog>
    );

    // Responsive container padding: p-4 on mobile, sm:p-6 on desktop
    expect(html).toContain('p-4');
    expect(html).toContain('sm:p-6');

    // Dialog card width: w-full on mobile, max-w-lg bounded
    expect(html).toContain('w-full');
    expect(html).toContain('max-w-lg');

    // Dialog footer layout: flex-col-reverse on mobile, sm:flex-row on desktop
    expect(html).toContain('flex-col-reverse');
    expect(html).toContain('sm:flex-row');
  });
});
