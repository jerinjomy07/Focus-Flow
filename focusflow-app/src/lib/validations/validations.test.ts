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
  it('accepts valid timer durations', () => {
    const result = UpdateSettingsSchema.safeParse({
      focusDuration: 30,
      shortBreakDuration: 5,
      longBreakDuration: 20,
      theme: 'DARK',
    });
    expect(result.success).toBe(true);
  });

  it('rejects focus duration < 1 or > 120 minutes', () => {
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 0 }).success).toBe(false);
    expect(UpdateSettingsSchema.safeParse({ focusDuration: 130 }).success).toBe(false);
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

