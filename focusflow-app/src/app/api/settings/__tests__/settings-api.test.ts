// src/app/api/settings/__tests__/settings-api.test.ts
// FocusFlow — Settings API Route Unit Tests (Phase 10)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import * as authModule from '@/lib/auth';
import * as dbModule from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    getSettingsByUserId: vi.fn(),
    updateSettings: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
  };
});

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetSettingsByUserId = vi.mocked(dbModule.getSettingsByUserId as unknown as (userId: string) => Promise<unknown>);
const mockUpdateSettings = vi.mocked(dbModule.updateSettings as unknown as (userId: string, data: unknown) => Promise<unknown>);
const mockGetUserById = vi.mocked(dbModule.getUserById as unknown as (userId: string) => Promise<unknown>);
const mockUpdateUser = vi.mocked(dbModule.updateUser as unknown as (userId: string, data: unknown) => Promise<unknown>);

describe('Settings API — GET /api/settings', () => {
  const userId = 'usr_test_settings';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns user settings combined with user timezone', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockGetSettingsByUserId.mockResolvedValue({
      id: 'settings-1',
      userId,
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      soundEnabled: true,
      soundVolume: 80,
      notificationsEnabled: true,
      autoStartBreaks: false,
      autoStartFocus: false,
      theme: 'SYSTEM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetUserById.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      timezone: 'America/New_York',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focusDuration).toBe(25);
    expect(body.data.timezone).toBe('America/New_York');
  });

  it('falls back to UTC if user has no timezone set', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockGetSettingsByUserId.mockResolvedValue({
      id: 'settings-1',
      userId,
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      soundEnabled: true,
      soundVolume: 80,
      notificationsEnabled: true,
      autoStartBreaks: false,
      autoStartFocus: false,
      theme: 'SYSTEM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetUserById.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      timezone: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.timezone).toBe('UTC');
  });
});

describe('Settings API — PATCH /api/settings', () => {
  const userId = 'usr_test_settings';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ focusDuration: 30 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('successfully updates timer settings and timezone', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockUpdateSettings.mockResolvedValue({
      id: 'settings-1',
      userId,
      focusDuration: 30,
      shortBreakDuration: 6,
      longBreakDuration: 20,
      sessionsBeforeLongBreak: 4,
      soundEnabled: true,
      soundVolume: 80,
      notificationsEnabled: true,
      autoStartBreaks: false,
      autoStartFocus: false,
      theme: 'DARK',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateUser.mockResolvedValue({
      id: userId,
      timezone: 'Europe/London',
    });
    mockGetUserById.mockResolvedValue({
      id: userId,
      timezone: 'Europe/London',
    });

    const req = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focusDuration: 30,
        shortBreakDuration: 6,
        longBreakDuration: 20,
        theme: 'DARK',
        timezone: 'Europe/London',
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focusDuration).toBe(30);
    expect(body.data.theme).toBe('DARK');
    expect(body.data.timezone).toBe('Europe/London');
    expect(mockUpdateUser).toHaveBeenCalledWith(userId, { timezone: 'Europe/London' });
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        focusDuration: 30,
        shortBreakDuration: 6,
        longBreakDuration: 20,
        theme: 'DARK',
      })
    );
  });

  it('rejects invalid IANA timezone with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });

    const req = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timezone: 'Invalid/City_Name_DoesNotExist',
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects out-of-range duration values with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });

    const req = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focusDuration: 300, // max is 120
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
