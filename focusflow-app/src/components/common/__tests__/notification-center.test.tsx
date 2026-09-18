// src/components/common/__tests__/notification-center.test.tsx
// FocusFlow — NotificationCenter Presentation Component Unit Tests

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NotificationCenter } from '../notification-center';
import * as rq from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof rq>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

const mockUseQuery = vi.mocked(rq.useQuery as unknown as (...args: unknown[]) => unknown);

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('NotificationCenter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell button without unread badge when unreadCount is 0', () => {
    mockUseQuery.mockReturnValue({
      data: {
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, pageSize: 20, totalPages: 0, hasMore: false },
      },
      isLoading: false,
      isError: false,
    });

    const html = render(<NotificationCenter />);

    expect(html).toContain('aria-label="Notifications"');
    expect(html).not.toContain('data-testid="unread-badge"');
  });

  it('renders unread count badge when unreadCount is greater than 0', () => {
    mockUseQuery.mockReturnValue({
      data: {
        data: [
          {
            id: 'n-1',
            userId: 'u-1',
            type: 'FOCUS_SESSION_COMPLETED',
            title: 'Focus session completed',
            body: 'Your 25-minute focus session has been completed.',
            readAt: null,
            metadata: { focusSessionId: 'sess-1' },
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { unreadCount: 3, total: 1, page: 1, pageSize: 20, totalPages: 1, hasMore: false },
      },
      isLoading: false,
      isError: false,
    });

    const html = render(<NotificationCenter />);

    expect(html).toContain('aria-label="Notifications, 3 unread"');
    expect(html).toContain('data-testid="unread-badge"');
    expect(html).toContain('>3<');
  });

  it('caps unread count badge at "99+" for large counts', () => {
    mockUseQuery.mockReturnValue({
      data: {
        data: [],
        meta: { unreadCount: 150, total: 150, page: 1, pageSize: 20, totalPages: 8, hasMore: true },
      },
      isLoading: false,
      isError: false,
    });

    const html = render(<NotificationCenter />);

    expect(html).toContain('aria-label="Notifications, 150 unread"');
    expect(html).toContain('99+');
  });
});
