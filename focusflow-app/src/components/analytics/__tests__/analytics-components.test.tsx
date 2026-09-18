// src/components/analytics/__tests__/analytics-components.test.tsx
// FocusFlow — Analytics UI Components Unit Tests (Node/SSR Render-Verified)

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  AnalyticsHeader,
  OverviewKpiGrid,
  PeakFocusBanner,
  SecondaryMetricsBar,
  WeekdayDistributionChart,
  HourlyDistributionChart,
  AnalyticsProjectDistribution,
  ConsistencyWidget,
} from '../index';
import type {
  AnalyticsOverviewResponse,
  WeekdayAnalyticsPoint,
  HourlyAnalyticsPoint,
  ProjectAnalyticsPoint,
} from '@/types/api';

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('Analytics UI Components', () => {
  describe('AnalyticsHeader', () => {
    it('renders all period buttons and header metadata', () => {
      const html = render(<AnalyticsHeader period="week" onPeriodChange={vi.fn()} />);

      expect(html).toContain('Productivity Analytics');
      expect(html).toContain('Today');
      expect(html).toContain('Yesterday');
      expect(html).toContain('This Week');
      expect(html).toContain('This Month');
      expect(html).toContain('Custom Range');
      expect(html).toContain('aria-selected="true"');
    });

    it('renders custom date controls and dateError when custom period is selected', () => {
      const html = render(
        <AnalyticsHeader
          period="custom"
          onPeriodChange={vi.fn()}
          startDate="2026-09-10"
          endDate="2026-09-17"
          onStartDateChange={vi.fn()}
          onEndDateChange={vi.fn()}
          dateError="Start date cannot be after end date"
        />
      );

      expect(html).toContain('data-testid="analytics-custom-date-controls"');
      expect(html).toContain('id="analytics-start-date"');
      expect(html).toContain('id="analytics-end-date"');
      expect(html).toContain('Start date cannot be after end date');
    });

    it('renders quick range indicator when custom dates are valid without error', () => {
      const html = render(
        <AnalyticsHeader
          period="custom"
          onPeriodChange={vi.fn()}
          startDate="2026-09-10"
          endDate="2026-09-17"
        />
      );

      expect(html).toContain('2026-09-10 → 2026-09-17');
    });
  });

  describe('OverviewKpiGrid', () => {
    const mockOverview: AnalyticsOverviewResponse = {
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      period: 'week',
      completedFocusSeconds: 7200,
      completedFocusMinutes: 120,
      completedFocusSessions: 4,
      abandonedFocusSeconds: 600,
      abandonedFocusSessions: 1,
      completionRate: 80,
      averageCompletedSessionSeconds: 1800,
      longestCompletedSessionSeconds: 2400,
      totalBreakSeconds: 1200,
      totalSessions: 6,
      activeFocusDays: 3,
      totalDaysInRange: 7,
      consistencyRate: (3 / 7) * 100,
      previousPeriod: {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      },
      comparisons: {
        focusTime: {
          currentValue: 7200,
          previousValue: 3600,
          absoluteDelta: 3600,
          percentageDelta: 100,
          direction: 'up',
        },
        completedSessions: {
          currentValue: 4,
          previousValue: 2,
          absoluteDelta: 2,
          percentageDelta: 100,
          direction: 'up',
        },
        completionRate: {
          currentValue: 80,
          previousValue: 50,
          absoluteDelta: 30,
          percentageDelta: 60,
          direction: 'up',
        },
        abandonedSessions: {
          currentValue: 1,
          previousValue: 0,
          absoluteDelta: 1,
          percentageDelta: null,
          direction: 'up',
        },
      },
    };

    it('renders loading skeleton when isLoading is true', () => {
      const html = render(<OverviewKpiGrid isLoading={true} />);
      expect(html).toContain('data-testid="kpi-grid-skeleton"');
    });

    it('renders metrics and delta badges accurately', () => {
      const html = render(<OverviewKpiGrid overview={mockOverview} />);

      expect(html).toContain('2h 0m');
      expect(html).toContain('4');
      expect(html).toContain('80.0%');
      expect(html).toContain('42.9%');
      expect(html).toContain('3 of 7 days with completed focus');
      expect(html).toContain('data-testid="delta-up"');
      expect(html).toContain('+100% vs prev');
      expect(html).toContain('+30.0% pts vs prev');
    });
  });

  describe('PeakFocusBanner', () => {
    it('renders empty prompt when no peak data exists', () => {
      const html = render(<PeakFocusBanner peakWeekday={null} peakHour={null} />);
      expect(html).toContain('data-testid="peak-focus-banner-empty"');
      expect(html).toContain('Peak Focus Discovery');
    });

    it('renders highlighted peak day and hour', () => {
      const peakDay: WeekdayAnalyticsPoint = {
        weekday: 3,
        label: 'Thu',
        completedFocusSeconds: 5400,
        completedFocusMinutes: 90,
        completedSessions: 3,
        averageSessionSeconds: 1800,
      };

      const peakHour: HourlyAnalyticsPoint = {
        hour: 14,
        label: '14:00',
        completedFocusSeconds: 3600,
        completedFocusMinutes: 60,
        completedSessions: 2,
      };

      const html = render(<PeakFocusBanner peakWeekday={peakDay} peakHour={peakHour} />);

      expect(html).toContain('data-testid="peak-focus-banner"');
      expect(html).toContain('Thursday');
      expect(html).toContain('90m of deep work across 3 blocks');
      expect(html).toContain('14:00 (2:00 PM)');
      expect(html).toContain('60m focused across 2 sessions');
    });
  });

  describe('SecondaryMetricsBar', () => {
    it('renders average duration, longest session, abandoned count, and breaks', () => {
      const overview: Partial<AnalyticsOverviewResponse> = {
        averageCompletedSessionSeconds: 1500, // 25m
        longestCompletedSessionSeconds: 3000, // 50m
        abandonedFocusSessions: 2,
        totalBreakSeconds: 1800, // 30m
        comparisons: {
          abandonedSessions: {
            currentValue: 2,
            previousValue: 1,
            absoluteDelta: 1,
            percentageDelta: 100,
            direction: 'up',
          },
        } as unknown as AnalyticsOverviewResponse['comparisons'],
      };

      const html = render(<SecondaryMetricsBar overview={overview as AnalyticsOverviewResponse} />);

      expect(html).toContain('data-testid="secondary-metrics-bar"');
      expect(html).toContain('25m');
      expect(html).toContain('50m');
      expect(html).toContain('2');
      expect(html).toContain('30m');
      expect(html).toContain('+100%');
    });
  });

  describe('WeekdayDistributionChart', () => {
    it('renders empty state when all weekday points have zero seconds', () => {
      const emptyDays: WeekdayAnalyticsPoint[] = [
        { weekday: 0, label: 'Mon', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0, averageSessionSeconds: 0 },
        { weekday: 1, label: 'Tue', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0, averageSessionSeconds: 0 },
      ];

      const html = render(<WeekdayDistributionChart weekdayData={emptyDays} />);
      expect(html).toContain('No weekday focus data');
    });

    it('renders SVG chart with bars when data is provided', () => {
      const data: WeekdayAnalyticsPoint[] = [
        { weekday: 0, label: 'Mon', completedFocusSeconds: 3600, completedFocusMinutes: 60, completedSessions: 2, averageSessionSeconds: 1800 },
        { weekday: 1, label: 'Tue', completedFocusSeconds: 1800, completedFocusMinutes: 30, completedSessions: 1, averageSessionSeconds: 1800 },
      ];

      const html = render(<WeekdayDistributionChart weekdayData={data} peakWeekday={data[0]} />);
      expect(html).toContain('Weekday Distribution');
      expect(html).toContain('role="img"');
      expect(html).toContain('Mon');
      expect(html).toContain('Tue');
    });
  });

  describe('HourlyDistributionChart', () => {
    it('renders empty state when all hours have zero seconds', () => {
      const html = render(<HourlyDistributionChart hourlyData={[]} />);
      expect(html).toContain('No hourly activity recorded');
    });

    it('renders SVG histogram when hourly focus exists', () => {
      const hourly: HourlyAnalyticsPoint[] = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${String(i).padStart(2, '0')}:00`,
        completedFocusSeconds: i === 10 ? 3000 : 0,
        completedFocusMinutes: i === 10 ? 50 : 0,
        completedSessions: i === 10 ? 2 : 0,
      }));

      const html = render(<HourlyDistributionChart hourlyData={hourly} peakHour={hourly[10]} />);
      expect(html).toContain('24-Hour Focus Rhythm');
      expect(html).toContain('role="img"');
      expect(html).toContain('12:00');
    });
  });

  describe('AnalyticsProjectDistribution', () => {
    it('renders empty state when no active projects exist', () => {
      const html = render(<AnalyticsProjectDistribution projects={[]} />);
      expect(html).toContain('No project focus recorded');
    });

    it('renders project list with colors, unrounded percentage presentation, and Unassigned', () => {
      const projects: ProjectAnalyticsPoint[] = [
        {
          projectId: 'p1',
          projectName: 'Frontend UI',
          projectColor: '#3b82f6',
          isArchived: false,
          completedFocusSeconds: 7200,
          completedFocusMinutes: 120,
          sessionCount: 4,
          percentage: 66.6666666667,
        },
        {
          projectId: null,
          projectName: 'Unassigned',
          projectColor: null,
          isArchived: false,
          completedFocusSeconds: 3600,
          completedFocusMinutes: 60,
          sessionCount: 2,
          percentage: 33.3333333333,
        },
      ];

      const html = render(<AnalyticsProjectDistribution projects={projects} />);

      expect(html).toContain('Frontend UI');
      expect(html).toContain('66.7%');
      expect(html).toContain('Unassigned');
      expect(html).toContain('33.3%');
      expect(html).toContain('style="background-color:#3b82f6"');
    });
  });

  describe('ConsistencyWidget', () => {
    it('renders factual active day count, total day count, and consistency percentage', () => {
      const html = render(
        <ConsistencyWidget
          activeFocusDays={8}
          totalDaysInRange={14}
          consistencyRate={(8 / 14) * 100}
        />
      );

      expect(html).toContain('8 / 14 active focus days');
      expect(html).toContain('8 of 14 calendar days');
      expect(html).toContain('57.1%');
      expect(html).toContain('role="progressbar"');
    });

    it('does not emit any qualitative habit tiers or scoring words', () => {
      // Test across various consistency rates (low, medium, high)
      const rates = [
        { active: 2, total: 14, rate: (2 / 14) * 100 },
        { active: 7, total: 14, rate: (7 / 14) * 100 },
        { active: 13, total: 14, rate: (13 / 14) * 100 },
      ];

      const bannedTiers = [
        'Excellent',
        'Good Habit',
        'Needs Improvement',
        'Poor Consistency',
        'Strong Habit',
        'Building Momentum',
        'Solid Focus Habit',
        'Exceptional Consistency',
      ];

      for (const { active, total, rate } of rates) {
        const html = render(
          <ConsistencyWidget
            activeFocusDays={active}
            totalDaysInRange={total}
            consistencyRate={rate}
          />
        );

        for (const tier of bannedTiers) {
          expect(html).not.toContain(tier);
        }
      }
    });
  });
});
