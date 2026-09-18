// src/app/api/notification-preferences/__tests__/notification-preferences-api.test.ts
// FocusFlow — Notification Preferences API Route Unit Tests (Phase 10)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import * as authModule from '@/lib/auth';
import { NotificationService } from '@/domain/services';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/domain/services', () => ({
  NotificationService: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetPreferences = vi.mocked(NotificationService.getPreferences as unknown as (userId: string) => Promise<unknown>);
const mockUpdatePreferences = vi.mocked(
  NotificationService.updatePreferences as unknown as (userId: string, data: unknown) => Promise<unknown>
);

describe('Notification Preferences API — GET /api/notification-preferences', () => {
  const userId = 'usr_test_prefs';

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

  it('returns current user preferences', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockGetPreferences.mockResolvedValue({
      id: 'pref-1',
      userId,
      focusSessionCompletion: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ focusSessionCompletion: true });
    expect(mockGetPreferences).toHaveBeenCalledWith(userId);
  });
});

describe('Notification Preferences API — PATCH /api/notification-preferences', () => {
  const userId = 'usr_test_prefs';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request('http://localhost/api/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusSessionCompletion: false }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('updates preference when valid boolean is provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockUpdatePreferences.mockResolvedValue({
      id: 'pref-1',
      userId,
      focusSessionCompletion: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new Request('http://localhost/api/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusSessionCompletion: false }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ focusSessionCompletion: false });
    expect(mockUpdatePreferences).toHaveBeenCalledWith(userId, {
      focusSessionCompletion: false,
    });
  });

  it('rejects non-boolean types with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });

    const req = new Request('http://localhost/api/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusSessionCompletion: 'disabled' }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
  });

  it('rejects malformed json with 400 INVALID_JSON', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });

    const req = new Request('http://localhost/api/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_JSON');
  });
});
