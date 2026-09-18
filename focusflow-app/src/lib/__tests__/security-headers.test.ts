// src/lib/__tests__/security-headers.test.ts
// FocusFlow — Security Headers Configuration Tests
//
// Verifies that next.config.ts exports a headers() function and that
// the function returns all required security headers for all routes.

import { describe, it, expect } from 'vitest';

// Dynamic import to avoid ESM/CJS interop issues
async function getNextConfig() {
  // next.config.ts exports a default NextConfig object
  const mod = await import('../../../next.config');
  return mod.default;
}

describe('next.config.ts — Security Headers', () => {
  it('exports a headers() function', async () => {
    const config = await getNextConfig();
    expect(typeof config.headers).toBe('function');
  });

  it('returns a header rule matching all routes (/(.*) source)', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const catchAll = rules.find((r) => r.source === '/(.*)');
    expect(catchAll).toBeDefined();
  });

  it('includes X-Content-Type-Options: nosniff', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const headers = rules.find((r) => r.source === '/(.*)')!.headers;
    const header = headers.find((h) => h.key === 'X-Content-Type-Options');
    expect(header).toBeDefined();
    expect(header!.value).toBe('nosniff');
  });

  it('includes Referrer-Policy: strict-origin-when-cross-origin', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const headers = rules.find((r) => r.source === '/(.*)')!.headers;
    const header = headers.find((h) => h.key === 'Referrer-Policy');
    expect(header).toBeDefined();
    expect(header!.value).toBe('strict-origin-when-cross-origin');
  });

  it('includes X-Frame-Options: DENY', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const headers = rules.find((r) => r.source === '/(.*)')!.headers;
    const header = headers.find((h) => h.key === 'X-Frame-Options');
    expect(header).toBeDefined();
    expect(header!.value).toBe('DENY');
  });

  it('includes Permissions-Policy header', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const headers = rules.find((r) => r.source === '/(.*)')!.headers;
    const header = headers.find((h) => h.key === 'Permissions-Policy');
    expect(header).toBeDefined();
    expect(header!.value).toContain('camera=()');
    expect(header!.value).toContain('microphone=()');
    expect(header!.value).toContain('geolocation=()');
  });

  it('includes Content-Security-Policy header with frame-ancestors none', async () => {
    const config = await getNextConfig();
    const rules = await config.headers!();
    const headers = rules.find((r) => r.source === '/(.*)')!.headers;
    const header = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(header).toBeDefined();
    expect(header!.value).toContain("default-src 'self'");
    expect(header!.value).toContain("frame-ancestors 'none'");
  });
});
