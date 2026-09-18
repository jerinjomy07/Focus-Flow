// mobile/src/api/analytics.ts
// FocusFlow Mobile — Advanced Analytics API Endpoints

import { api } from './client';
import { AnalyticsOverview, HourlyDistribution, WeekdayDistribution } from '../types';

export interface DistributionsResponse {
  hourly: HourlyDistribution[];
  weekday: WeekdayDistribution[];
}

export const analyticsApi = {
  getOverview: async (range: '7D' | '14D' | '30D' = '7D'): Promise<AnalyticsOverview> => {
    const res = await api.get<any>(`/analytics/overview?range=${range}`);
    return res?.overview || res;
  },

  getDistributions: async (range: '7D' | '14D' | '30D' = '7D'): Promise<DistributionsResponse> => {
    const res = await api.get<any>(`/analytics/distributions?range=${range}`);
    const data = res?.data || res;
    const rawWeekday = data?.weekday || [];
    const rawHourly = data?.hourly || [];

    const weekday: WeekdayDistribution[] = rawWeekday.map((w: any) => ({
      weekday: w.weekday,
      dayName: w.dayName || w.label || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][w.weekday] || '',
      focusSeconds: w.focusSeconds ?? w.completedFocusSeconds ?? 0,
      sessionCount: w.sessionCount ?? w.completedSessions ?? 0,
    }));

    const hourly: HourlyDistribution[] = rawHourly.map((h: any) => ({
      hour: h.hour,
      focusSeconds: h.focusSeconds ?? h.completedFocusSeconds ?? 0,
      sessionCount: h.sessionCount ?? h.completedSessions ?? 0,
    }));

    return { hourly, weekday };
  },
};
