// src/lib/query-keys.ts
// FocusFlow — Canonical TanStack Query Key Hierarchy
// Follows Section 2.2 of docs/state-management.md.

import type { SessionListQuery, ProductivitySummaryQuery } from '@/types/api';

/**
 * Deterministically normalizes query parameters:
 * - Drops undefined/null/empty string keys
 * - Sorts object keys alphabetically
 * Guarantees that equivalent queries yield identical cache keys.
 */
export function normalizeParams<T extends object>(params?: T): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, unknown> = {};
  const keys = Object.keys(params).sort() as Array<keyof T>;

  for (const key of keys) {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '') {
      cleaned[key as string] = val;
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export const queryKeys = {
  user: ['user'] as const,
  settings: ['settings'] as const,
  projects: {
    all: ['projects'] as const,
    list: (status?: string) => ['projects', { status }] as const,
    detail: (id: string) => ['projects', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (filters?: Record<string, unknown>) => ['tasks', normalizeParams(filters)] as const,
    detail: (id: string) => ['tasks', id] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    active: ['sessions', 'active'] as const,
    list: (query?: SessionListQuery) => ['sessions', 'list', normalizeParams(query)] as const,
    detail: (id: string) => ['sessions', 'detail', id] as const,
    history: (page: number) => ['sessions', 'history', page] as const,
  },
  productivity: {
    all: ['productivity'] as const,
    summary: (query?: ProductivitySummaryQuery) => ['productivity', 'summary', normalizeParams(query)] as const,
    trend: (query?: ProductivitySummaryQuery) => ['productivity', 'trend', normalizeParams(query)] as const,
    projects: (query?: ProductivitySummaryQuery) => ['productivity', 'projects', normalizeParams(query)] as const,
    task: (id: string) => ['productivity', 'task', id] as const,
  },
  analytics: {
    summary: (period: string) => ['analytics', 'summary', period] as const,
    trend: (days: number) => ['analytics', 'trend', days] as const,
    byProject: (period: string) => ['analytics', 'by-project', period] as const,
    overview: (query?: ProductivitySummaryQuery) => ['analytics', 'overview', normalizeParams(query)] as const,
    distributions: (query?: ProductivitySummaryQuery) => ['analytics', 'distributions', normalizeParams(query)] as const,
  },
  goals: ['goals'] as const,
  notifications: {
    all: ['notifications'] as const,
    list: (query?: Record<string, unknown>) => ['notifications', 'list', normalizeParams(query)] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  notificationPreferences: ['notification-preferences'] as const,
} as const;
