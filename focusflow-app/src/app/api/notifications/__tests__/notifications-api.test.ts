// src/app/api/notifications/__tests__/notifications-api.test.ts
// FocusFlow — Notifications API Route Unit Tests (Phase 10)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { PATCH } from '../[id]/read/route';
import { POST } from '../read-all/route';
import * as authModule from '@/lib/auth';
import { NotificationService } from '@/domain/services';
import { NotFoundError } from '@/lib/errors';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/domain/services', () => ({
  NotificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetNotifications = vi.mocked(
  NotificationService.getNotifications as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockMarkAsRead = vi.mocked(
  NotificationService.markAsRead as unknown as (userId: string, id: string) => Promise<unknown>
);
const mockMarkAllAsRead = vi.mocked(
  NotificationService.markAllAsRead as unknown as (userId: string) => Promise<unknown>
);

describe('Notifications Collection API — GET /api/notifications', () => {
  const userId = 'usr_test_notifs';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request('http://localhost/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns paginated notifications and metadata', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    const now = new Date();
    mockGetNotifications.mockResolvedValue({
      notifications: [
        {
          id: 'notif-1',
          userId,
          type: 'FOCUS_SESSION_COMPLETED',
          title: 'Focus session completed',
          body: 'Your 25-minute focus session has been completed.',
          readAt: null,
          metadata: { focusSessionId: 'sess-1' },
          createdAt: now,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasMore: false,
      unreadCount: 1,
    });

    const req = new Request('http://localhost/api/notifications?page=1&pageSize=20');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('notif-1');
    expect(body.data[0].readAt).toBeNull();
    expect(body.meta.unreadCount).toBe(1);
    expect(mockGetNotifications).toHaveBeenCalledWith(userId, {
      page: 1,
      pageSize: 20,
      unreadOnly: undefined,
    });
  });

  it('rejects pageSize > 50 with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });

    const req = new Request('http://localhost/api/notifications?pageSize=100');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mockGetNotifications).not.toHaveBeenCalled();
  });
});

describe('Notification Single Mark-as-Read API — PATCH /api/notifications/[id]/read', () => {
  const userId = 'usr_test_notifs';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request('http://localhost/api/notifications/notif-1/read', { method: 'PATCH' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) });
    expect(res.status).toBe(401);
  });

  it('marks notification read and returns updated resource', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    const readDate = new Date();
    mockMarkAsRead.mockResolvedValue({
      id: 'notif-1',
      userId,
      type: 'FOCUS_SESSION_COMPLETED',
      title: 'Focus session completed',
      body: 'Your 25-minute focus session has been completed.',
      readAt: readDate,
      metadata: { focusSessionId: 'sess-1' },
      createdAt: new Date(),
    });

    const req = new Request('http://localhost/api/notifications/notif-1/read', { method: 'PATCH' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.id).toBe('notif-1');
    expect(body.data.readAt).toBe(readDate.toISOString());
    expect(mockMarkAsRead).toHaveBeenCalledWith(userId, 'notif-1');
  });

  it('returns 404 NOT_FOUND when notification does not exist or belongs to another user', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockMarkAsRead.mockRejectedValue(new NotFoundError('Notification not found'));

    const req = new Request('http://localhost/api/notifications/notif-other/read', { method: 'PATCH' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'notif-other' }) });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('Notification Mark-All-Read API — POST /api/notifications/read-all', () => {
  const userId = 'usr_test_notifs';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('marks all notifications read and returns count', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } });
    mockMarkAllAsRead.mockResolvedValue({ count: 4 });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.count).toBe(4);
    expect(mockMarkAllAsRead).toHaveBeenCalledWith(userId);
  });
});
