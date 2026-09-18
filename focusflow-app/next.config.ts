// next.config.ts
// FocusFlow — Next.js Configuration
// Includes security headers for hardened HTTP responses.

import type { NextConfig } from 'next';

const securityHeaders = [
  // Prevent MIME-type sniffing: always honour declared Content-Type
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Controls how much referrer information is included with requests.
  // "strict-origin-when-cross-origin" sends full URL for same-origin,
  // only origin for cross-origin HTTPS→HTTPS, and nothing for HTTPS→HTTP.
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Prevent the page from being embedded in an iframe (clickjacking protection).
  // Redundant when CSP frame-ancestors is set, but kept as defence-in-depth
  // for older browsers that do not support CSP.
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Deny access to powerful browser features not needed by FocusFlow.
  // Web Audio API (oscillator synthesis used by the timer) is allowed via allow=().
  // The timer uses AudioContext directly from JavaScript — no Feature-Policy needed.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // Content Security Policy.
  // - 'unsafe-inline' is required for Next.js hydration inline scripts and Tailwind inline styles.
  // - 'blob:' on img-src supports canvas-rendered images used by chart components.
  // - frame-ancestors 'none' is the modern equivalent of X-Frame-Options: DENY.
  // - Phase 12: tighten script-src with nonce-based CSP when server-side rendering supports it.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const isProduction = process.env.NODE_ENV === 'production';

const productionSecurityHeaders = isProduction
  ? [
      ...securityHeaders,
      // HTTP Strict Transport Security (HSTS)
      // Enforced exclusively in production HTTPS environments to prevent protocol downgrade.
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      },
    ]
  : securityHeaders;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: productionSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
