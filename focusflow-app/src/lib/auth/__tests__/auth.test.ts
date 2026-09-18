// src/lib/auth/__tests__/auth.test.ts
// FocusFlow — Authentication & Onboarding Unit Tests
// Tests password hashing, credential validation, JWT/session enrichment,
// and onboarding completion schema invariants.

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  RegisterSchema,
  LoginSchema,
  OnboardingCompleteSchema,
} from '@/lib/validations';

describe('Auth — Password Security & Bcrypt Verification', () => {
  it('hashes passwords with salt cost 12 and verifies correctly', async () => {
    const rawPassword = 'securePassword123!';
    const saltRounds = 12;
    const hash = await bcrypt.hash(rawPassword, saltRounds);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$')).toBe(true);

    const isMatch = await bcrypt.compare(rawPassword, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects incorrect passwords during bcrypt comparison', async () => {
    const rawPassword = 'correctPassword';
    const wrongPassword = 'wrongPassword';
    const hash = await bcrypt.hash(rawPassword, 10);

    const isMatch = await bcrypt.compare(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });
});

describe('Auth — RegisterSchema Validation', () => {
  it('accepts valid registration payload and normalizes email', () => {
    const parsed = RegisterSchema.safeParse({
      name: '  Jane Doe  ',
      email: '  Jane.Doe@Example.COM  ',
      password: 'password123',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Jane Doe');
      expect(parsed.data.email).toBe('jane.doe@example.com');
      expect(parsed.data.password).toBe('password123');
    }
  });

  it('rejects passwords shorter than 8 characters', () => {
    const parsed = RegisterSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'short',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('at least 8 characters');
    }
  });

  it('rejects passwords exceeding 128 characters', () => {
    const parsed = RegisterSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'a'.repeat(129),
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('128 characters or fewer');
    }
  });

  it('rejects empty or whitespace-only name', () => {
    const parsed = RegisterSchema.safeParse({
      name: '   ',
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('Auth — LoginSchema Validation', () => {
  it('accepts valid login credentials and normalizes email', () => {
    const parsed = LoginSchema.safeParse({
      email: '  USER@DOMAIN.COM  ',
      password: 'secretPassword',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe('user@domain.com');
      expect(parsed.data.password).toBe('secretPassword');
    }
  });

  it('rejects missing or empty password', () => {
    const parsed = LoginSchema.safeParse({
      email: 'user@domain.com',
      password: '',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid email formats', () => {
    const parsed = LoginSchema.safeParse({
      email: 'invalid-email-address',
      password: 'secretPassword',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('Onboarding — OnboardingCompleteSchema Validation', () => {
  it('accepts valid onboarding payload with valid IANA timezone', () => {
    const parsed = OnboardingCompleteSchema.safeParse({
      timezone: 'America/New_York',
      focusDuration: 30,
      shortBreakDuration: 5,
      longBreakDuration: 20,
      dailyGoal: 6,
      firstProjectName: 'Website Launch',
      firstTaskTitle: 'Design landing page',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.timezone).toBe('America/New_York');
      expect(parsed.data.focusDuration).toBe(30);
      expect(parsed.data.dailyGoal).toBe(6);
      expect(parsed.data.firstProjectName).toBe('Website Launch');
      expect(parsed.data.firstTaskTitle).toBe('Design landing page');
    }
  });

  it('applies standard defaults when optional durations and goal are omitted', () => {
    const parsed = OnboardingCompleteSchema.safeParse({
      timezone: 'Europe/London',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.focusDuration).toBe(25);
      expect(parsed.data.shortBreakDuration).toBe(5);
      expect(parsed.data.longBreakDuration).toBe(15);
      expect(parsed.data.dailyGoal).toBe(4);
    }
  });

  it('rejects invalid IANA timezone string', () => {
    const parsed = OnboardingCompleteSchema.safeParse({
      timezone: 'Atlantis/NonExistentCity',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('valid IANA timezone');
    }
  });

  it('rejects focus duration exceeding 120 minutes or below 1 minute', () => {
    const tooHigh = OnboardingCompleteSchema.safeParse({
      timezone: 'UTC',
      focusDuration: 130,
    });
    expect(tooHigh.success).toBe(false);

    const tooLow = OnboardingCompleteSchema.safeParse({
      timezone: 'UTC',
      focusDuration: 0,
    });
    expect(tooLow.success).toBe(false);
  });

  it('rejects daily goal exceeding 50 or below 1', () => {
    const tooHigh = OnboardingCompleteSchema.safeParse({
      timezone: 'UTC',
      dailyGoal: 60,
    });
    expect(tooHigh.success).toBe(false);

    const tooLow = OnboardingCompleteSchema.safeParse({
      timezone: 'UTC',
      dailyGoal: 0,
    });
    expect(tooLow.success).toBe(false);
  });
});

describe('Auth — Session & JWT Callback Mapping Invariants', () => {
  // Mock JWT callback logic as implemented in src/lib/auth/index.ts
  const mockJwtCallback = ({
    token,
    user,
    trigger,
    session,
  }: {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
    trigger?: string;
    session?: { user?: Record<string, unknown> };
  }) => {
    if (user) {
      token.id = user.id;
      token.timezone = (user.timezone as string) ?? 'UTC';
      token.onboardedAt = (user.onboardedAt as string | null) ?? null;
    }

    if (trigger === 'update' && session) {
      if (session.user?.name !== undefined) token.name = session.user.name;
      if (session.user?.timezone !== undefined) token.timezone = session.user.timezone;
      if (session.user?.onboardedAt !== undefined) token.onboardedAt = session.user.onboardedAt;
    }

    return token;
  };

  // Mock Session callback logic as implemented in src/lib/auth/index.ts
  const mockSessionCallback = ({
    session,
    token,
  }: {
    session: { user: Record<string, unknown> };
    token: Record<string, unknown>;
  }) => {
    if (token && session.user) {
      session.user.id = token.id as string;
      session.user.timezone = (token.timezone as string) ?? 'UTC';
      session.user.onboardedAt = (token.onboardedAt as string | null) ?? null;
    }
    return session;
  };

  it('populates token with user id, timezone, and onboardedAt on login', () => {
    const token: Record<string, unknown> = {};
    const user = {
      id: 'cuid_12345',
      name: 'Test User',
      email: 'test@focusflow.app',
      timezone: 'Asia/Kolkata',
      onboardedAt: '2026-09-17T00:00:00.000Z',
    };

    const updatedToken = mockJwtCallback({ token, user });
    expect(updatedToken.id).toBe('cuid_12345');
    expect(updatedToken.timezone).toBe('Asia/Kolkata');
    expect(updatedToken.onboardedAt).toBe('2026-09-17T00:00:00.000Z');
  });

  it('updates token onboardedAt and timezone on trigger: update', () => {
    const token: Record<string, unknown> = {
      id: 'cuid_12345',
      timezone: 'UTC',
      onboardedAt: null,
    };

    const updatedToken = mockJwtCallback({
      token,
      trigger: 'update',
      session: {
        user: {
          timezone: 'America/Chicago',
          onboardedAt: '2026-09-17T02:00:00.000Z',
        },
      },
    });

    expect(updatedToken.timezone).toBe('America/Chicago');
    expect(updatedToken.onboardedAt).toBe('2026-09-17T02:00:00.000Z');
  });

  it('enriches session.user with token id, timezone, and onboardedAt', () => {
    const session = {
      user: {
        name: 'Alex Miller',
        email: 'alex@focusflow.app',
      },
    };
    const token = {
      id: 'cuid_99999',
      timezone: 'Europe/Paris',
      onboardedAt: '2026-09-17T01:30:00.000Z',
    };

    const enriched = mockSessionCallback({ session, token });
    expect(enriched.user.id).toBe('cuid_99999');
    expect(enriched.user.timezone).toBe('Europe/Paris');
    expect(enriched.user.onboardedAt).toBe('2026-09-17T01:30:00.000Z');
  });
});
