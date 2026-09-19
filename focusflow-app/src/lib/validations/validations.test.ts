// src/lib/validations/validations.test.ts
// FocusFlow — Runtime Validation Schemas Unit Tests
// Tests boundary conditions, string constraints, numeric limits,
// and enum validations using Zod.

import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  CreateProjectSchema,
  CreateTaskSchema,
  StartSessionSchema,
  EndSessionSchema,
  UpdateSettingsSchema,
  CreateGoalSchema,
} from './index';

describe('Validation Schemas — RegisterSchema', () => {
  it('accepts valid registration input', () => {
    const result = RegisterSchema.safeParse({
      name: 'Alex Miller',
      email: 'alex@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email formats', () => {
    const result = RegisterSchema.safeParse({
      name: 'Alex Miller',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Alex Miller',
      email: 'alex@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation Schemas — CreateProjectSchema', () => {
  it('accepts valid project with custom hex color', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'FocusFlow Architecture',
      description: 'System design documentation',
      color: '#6366f1',
    });
    expect(result.success).toBe(true);
  });

  it('defaults color to #6366f1 when omitted', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'FocusFlow Architecture',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe('#6366f1');
    }
  });

  it('rejects invalid hex colors', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'FocusFlow Architecture',
      color: 'not-a-color',
    });
    expect(result.success).toBe(false);

    const invalidLength = CreateProjectSchema.safeParse({
      name: 'FocusFlow Architecture',
      color: '#fff', // Only 3 characters — requires 6
    });
    expect(invalidLength.success).toBe(false);
  });
});

describe('Validation Schemas — CreateTaskSchema', () => {
  it('accepts valid task with priority and estimate', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Implement Timer State Machine',
      priority: 'HIGH',
      estimatedPomodoros: 4,
    });
    expect(result.success).toBe(true);
  });

  it('rejects estimated Pomodoros outside 1..50 range', () => {
    const zeroEstimate = CreateTaskSchema.safeParse({
      title: 'Invalid Task',
      estimatedPomodoros: 0,
    });
    expect(zeroEstimate.success).toBe(false);

    const excessiveEstimate = CreateTaskSchema.safeParse({
      title: 'Invalid Task',
      estimatedPomodoros: 100,
    });
    expect(excessiveEstimate.success).toBe(false);
  });
});

describe('Validation Schemas — StartSessionSchema', () => {
  it('accepts valid 25-minute focus session', () => {
    const result = StartSessionSchema.safeParse({
      type: 'FOCUS',
      plannedDuration: 1500, // 25 min in seconds
      startedAt: '2026-09-17T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects sessions shorter than 60 seconds or longer than 2 hours', () => {
    const tooShort = StartSessionSchema.safeParse({
      type: 'FOCUS',
      plannedDuration: 30, // 30 seconds
      startedAt: '2026-09-17T12:00:00.000Z',
    });
    expect(tooShort.success).toBe(false);

    const tooLong = StartSessionSchema.safeParse({
      type: 'FOCUS',
      plannedDuration: 10_000, // > 2 hours
      startedAt: '2026-09-17T12:00:00.000Z',
    });
    expect(tooLong.success).toBe(false);
  });

  it('rejects invalid session types', () => {
    const result = StartSessionSchema.safeParse({
      type: 'NAP',
      plannedDuration: 1500,
      startedAt: '2026-09-17T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('validates EndSessionSchema with completed status', () => {
    const result = EndSessionSchema.safeParse({
      status: 'COMPLETED',
      endedAt: '2026-09-17T12:25:00.000Z',
      actualDuration: 1500,
      pausedDuration: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('Validation Schemas — UpdateSettingsSchema', () => {
  it('accepts valid preset and custom focus durations (1–120 min)', () => {
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 25 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 45 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 50 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 1 }).success).toBe(true);  // Custom minimum boundary
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 35 }).success).toBe(true); // Custom intermediate
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 120 }).success).toBe(true); // Custom maximum boundary
  });

  it('rejects invalid focus durations (<= 0, > 120, decimals, non-numbers)', () => {
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 0 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ focusDuration: -5 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 121 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 25.5 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ focusDuration: '30' as unknown }).success).toBe(false);
  });

  it('accepts valid preset and custom short break durations (1–60 min)', () => {
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 5 }).success).toBe(true);  // Preset
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 10 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 1 }).success).toBe(true);  // Custom minimum
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 7 }).success).toBe(true);  // Custom intermediate
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 60 }).success).toBe(true); // Custom maximum
  });

  it('rejects invalid short break durations (<= 0, > 60, decimals, non-numbers)', () => {
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 0 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: -1 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 61 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ shortBreakDuration: 5.5 }).success).toBe(false);
  });

  it('accepts valid preset and custom long break durations (1–120 min)', () => {
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 15 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 20 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 30 }).success).toBe(true); // Preset
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 1 }).success).toBe(true);  // Custom minimum
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 40 }).success).toBe(true); // Custom intermediate
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 120 }).success).toBe(true); // Custom maximum
  });

  it('rejects invalid long break durations (<= 0, > 120, decimals, non-numbers)', () => {
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 0 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: -10 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 121 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ longBreakDuration: 15.2 }).success).toBe(false);
  });

  it('rejects invalid theme values', () => {
    expect(UpdateSettingsSchema.safeParse({ theme: 'BLUE' }).success).toBe(false);
  });
});

describe('Validation Schemas — CreateGoalSchema', () => {
  it('accepts valid daily Pomodoro count goal', () => {
    const result = CreateGoalSchema.safeParse({
      type: 'POMODORO_COUNT',
      target: 8,
      period: 'DAILY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative or zero goal target', () => {
    const result = CreateGoalSchema.safeParse({
      type: 'POMODORO_COUNT',
      target: 0,
      period: 'DAILY',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Mass-Assignment Protection (.strict()) Tests
// ============================================================

describe('Validation Schemas — .strict() mass-assignment protection', () => {
  it('RegisterSchema rejects unknown fields', () => {
    const result = RegisterSchema.safeParse({
      name: 'Alex Miller',
      email: 'alex@example.com',
      password: 'password123',
      role: 'admin', // unknown field
    });
    expect(result.success).toBe(false);
  });

  it('CreateProjectSchema rejects unknown fields', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'My Project',
      owner: 'hacker', // unknown field
    });
    expect(result.success).toBe(false);
  });

  it('CreateTaskSchema rejects unknown fields', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      userId: 'injected', // unknown field
    });
    expect(result.success).toBe(false);
  });

  it('StartSessionSchema rejects unknown fields', () => {
    const result = StartSessionSchema.safeParse({
      type: 'FOCUS',
      plannedDuration: 1500,
      startedAt: '2026-09-17T12:00:00.000Z',
      actualDuration: 0, // unknown field (only valid in EndSessionSchema)
    });
    expect(result.success).toBe(false);
  });
});

