// mobile/src/api/productivity.ts
// FocusFlow Mobile — Productivity Summary & Trends API Endpoints

import { api } from './client';
import { ProductivitySummary } from '../types';

export interface ProductivityTrendItem {
  date: string;
  focusSeconds: number;
  completedSessions: number;
}

export const productivityApi = {
  getSummary: async (range: 'TODAY' | 'WEEK' | 'MONTH' = 'TODAY'): Promise<ProductivitySummary> => {
    const period = range.toLowerCase();
    const res = await api.get<any>(`/productivity/summary?period=${period}`);
    return res?.summary || res;
  },

  getTrend: async (days: number = 7): Promise<ProductivityTrendItem[]> => {
    const res = await api.get<any>(`/productivity/trend?days=${days}`);
    return res?.trend || (Array.isArray(res) ? res : []);
  },
};
