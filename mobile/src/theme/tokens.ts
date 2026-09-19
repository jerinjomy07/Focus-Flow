// mobile/src/theme/tokens.ts
// FocusFlow Mobile — Dual Design System Tokens (Obsidian Kinetic & Terra)
//
// Source of Truth:
// - Obsidian Kinetic (Dark): mobile/design/stitch_focusflow_futuristic_redesign/obsidian_kinetic/DESIGN.md
// - Terra (Light): mobile/design/stitch_focusflow_futuristic_redesign/terra/DESIGN.md

export interface ThemeColors {
  // Canvas & Surfaces
  canvas: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  
  // Glassmorphic Layer Backgrounds (with alpha)
  glassL1: string;
  glassL2: string;
  glassL3: string;
  glassCard: string;

  // Text / Content
  text: string;
  textSecondary: string;
  textMuted: string;
  onSurface: string;
  onSurfaceVariant: string;

  // Primary & Accents
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  primaryGlow: string;

  // Secondary Axis (Cyan in Obsidian, Warm Sand/Earth in Terra)
  secondary: string;
  secondaryLight: string;
  secondaryContainer: string;
  onSecondary: string;
  secondaryGlow: string;

  // Tertiary (Violet in Obsidian, Warm Amber in Terra)
  tertiary: string;
  tertiaryContainer: string;
  onTertiary: string;

  // Borders & Specular Lines
  border: string;
  borderLight: string;
  borderAccent: string;
  specularGlint: string;

  // Status & Telemetry
  success: string;
  warning: string;
  danger: string;
  dangerMuted: string;
  error: string;
  onError: string;

  // Gradients (tuples of [start, end] or CSS-like representations)
  primaryGradient: readonly [string, string];
  secondaryGradient: readonly [string, string];
  timerGradient: readonly [string, string, string];

  // Timer Accents
  timerTrack: string;
  timerTick: string;
  timerHead: string;
}

export const obsidianKineticColors: ThemeColors = {
  // Canvas & Surfaces (Void Obsidian & Optical Blacks)
  canvas: '#080B11',
  surface: '#0D131F',
  surfaceDim: '#0D131F',
  surfaceBright: '#333947',
  surfaceContainerLowest: '#080E1A',
  surfaceContainerLow: '#161C28',
  surfaceContainer: '#1A202C',
  surfaceContainerHigh: '#242A37',
  surfaceContainerHighest: '#2F3542',

  // Glassmorphic Layer Backgrounds
  glassL1: 'rgba(13, 19, 31, 0.65)',
  glassL2: 'rgba(18, 26, 43, 0.75)',
  glassL3: 'rgba(27, 37, 61, 0.85)',
  glassCard: 'rgba(18, 26, 43, 0.72)',

  // Text
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  onSurface: '#DDE2F4',
  onSurfaceVariant: '#C7C4D7',

  // Primary & Violet Axis
  primary: '#6366F1',
  primaryLight: '#8B5CF6',
  primaryDark: '#494BD6',
  primaryContainer: '#8083FF',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#0D0096',
  primaryGlow: 'rgba(99, 102, 241, 0.35)',

  // Cyan Glow Axis (Telemetry & Flow)
  secondary: '#4CD7F6',
  secondaryLight: '#38BDF8',
  secondaryContainer: '#06B6D4',
  onSecondary: '#003640',
  secondaryGlow: 'rgba(76, 215, 246, 0.30)',

  // Tertiary
  tertiary: '#D2BBFF',
  tertiaryContainer: '#A476FF',
  onTertiary: '#3F008E',

  // Borders & Specular Lines
  border: 'rgba(45, 59, 85, 0.45)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(99, 102, 241, 0.30)',
  specularGlint: 'rgba(255, 255, 255, 0.15)',

  // Status & Telemetry
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  error: '#FFB4AB',
  onError: '#690005',

  // Gradients
  primaryGradient: ['#6366F1', '#7C3AED'],
  secondaryGradient: ['#4CD7F6', '#06B6D4'],
  timerGradient: ['#4CD7F6', '#8083FF', '#C0C1FF'],

  // Timer Accents
  timerTrack: '#161C28',
  timerTick: '#242A37',
  timerHead: '#4CD7F6',
};

export const terraColors: ThemeColors = {
  // Canvas & Surfaces (Rooted Warmth & Warm Cream)
  canvas: '#FAF6F0',
  surface: '#F6F3EC',
  surfaceDim: '#E8E3D8',
  surfaceBright: '#FAF6F0',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FCFBF7',
  surfaceContainer: '#F0ECE4',
  surfaceContainerHigh: '#E9E4D9',
  surfaceContainerHighest: '#E4E0D8',

  // Glass/Card Layer Backgrounds (Soft Organic)
  glassL1: 'rgba(255, 255, 255, 0.85)',
  glassL2: 'rgba(240, 236, 228, 0.90)',
  glassL3: 'rgba(233, 228, 217, 0.95)',
  glassCard: '#FFFFFF',

  // Text
  text: '#242E27',
  textSecondary: '#5F7166',
  textMuted: '#8A9990',
  onSurface: '#242E27',
  onSurfaceVariant: '#5F7166',

  // Forest Green Primary Axis
  primary: '#4A7C59',
  primaryLight: '#659D75',
  primaryDark: '#2A6038',
  primaryContainer: '#78A886',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#D8F0DE',
  primaryGlow: 'rgba(74, 124, 89, 0.25)',

  // Warm Amber & Sand Secondary Axis
  secondary: '#6B6358',
  secondaryLight: '#8C8275',
  secondaryContainer: '#F0E8DB',
  onSecondary: '#FFFFFF',
  secondaryGlow: 'rgba(107, 99, 88, 0.20)',

  // Tertiary (Warm Amber Accent)
  tertiary: '#8B6F3C',
  tertiaryContainer: '#C4A66A',
  onTertiary: '#FFFFFF',

  // Borders & Specular Lines
  border: 'rgba(210, 204, 192, 0.7)',
  borderLight: 'rgba(210, 204, 192, 0.4)',
  borderAccent: 'rgba(74, 124, 89, 0.35)',
  specularGlint: 'rgba(255, 255, 255, 0.60)',

  // Status & Telemetry
  success: '#2E7D32',
  warning: '#D97706',
  danger: '#B83230',
  dangerMuted: 'rgba(184, 50, 48, 0.15)',
  error: '#B83230',
  onError: '#FFFFFF',

  // Gradients
  primaryGradient: ['#4A7C59', '#3B6849'],
  secondaryGradient: ['#8B6F3C', '#705C30'],
  timerGradient: ['#4A7C59', '#78A886', '#8B6F3C'],

  // Timer Accents
  timerTrack: '#E4E0D8',
  timerTick: '#D2CCC0',
  timerHead: '#4A7C59',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  marginMobile: 16,
  marginTablet: 24,
  bottomDockHeight: 64,
  bottomDockOffset: 20,
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 9999,
};

export const typography = {
  // Backwards-compatible aliases
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  tiny: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },

  // Timer Display
  displayTimer: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -1 },
  displayTimerMobile: { fontSize: 44, fontWeight: '700' as const, letterSpacing: -0.5 },

  // Headlines
  headlineLg: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 },
  headlineMd: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, letterSpacing: -0.3 },
  headlineSm: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, letterSpacing: -0.2 },

  // Body
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  // HUD & Telemetry Badges
  labelCaps: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  labelTelemetry: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.5 },
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
};

export const layout = {
  minTouchTarget: 48,
};
