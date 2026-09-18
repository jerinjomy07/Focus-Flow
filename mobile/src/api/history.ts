// mobile/src/api/history.ts
// FocusFlow Mobile — Focus Session History API Endpoints

import { api } from './client';
import { FocusSession } from '../types';

export interface HistoryPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface HistoryResponse {
  sessions: FocusSession[];
  pagination: HistoryPagination;
}

export interface HistoryFilters {
  limit?: number;
  offset?: number;
  status?: string;
  from?: string;
  to?: string;
}

export const historyApi = {
  getSessionHistory: async (filters: HistoryFilters = {}): Promise<HistoryResponse> => {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.offset) params.append('offset', String(filters.offset));
    if (filters.status) params.append('status', filters.status);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get<any>(`/focus-sessions${query}`);
    if (Array.isArray(res)) {
      return {
        sessions: res,
        pagination: { total: res.length, limit: filters.limit || 50, offset: filters.offset || 0, hasMore: false },
      };
    }
    return {
      sessions: res?.sessions || [],
      pagination: res?.pagination || res?.meta || { total: 0, limit: 50, offset: 0, hasMore: false },
    };
  },
};
