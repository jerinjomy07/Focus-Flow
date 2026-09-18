// mobile/src/theme/index.ts
// FocusFlow Mobile — Visual Design Tokens & Theme

export const colors = {
  // Backgrounds
  background: '#0F172A', // Slate 900
  surface: '#1E293B',    // Slate 800
  surfaceLight: '#334155', // Slate 700
  surfaceHighlight: '#475569', // Slate 600

  // Brand / Accents
  primary: '#6366F1',    // Indigo 500
  primaryDark: '#4F46E5', // Indigo 600
  primaryLight: '#818CF8', // Indigo 400
  primaryMuted: 'rgba(99, 102, 241, 0.15)',

  // Semantic Status
  success: '#10B981',    // Emerald 500
  successMuted: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',    // Amber 500
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',     // Rose 500
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  info: '#0EA5E9',       // Sky 500

  // Text
  text: '#F8FAFC',       // Slate 50
  textSecondary: '#94A3B8', // Slate 400
  textMuted: '#64748B',  // Slate 500
  textInverse: '#0F172A',

  // Borders & Dividers
  border: '#334155',
  borderLight: '#475569',

  // Timer Colors
  timerFocus: '#6366F1',
  timerShortBreak: '#10B981',
  timerLongBreak: '#0EA5E9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  tiny: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
  timerDisplay: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -1 },
};

export const layout = {
  minTouchTarget: 48, // WCAG 2.5.5 / Android touch target minimum (48dp)
};
