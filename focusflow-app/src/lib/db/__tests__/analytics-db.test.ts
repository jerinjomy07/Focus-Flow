// src/lib/db/__tests__/analytics-db.test.ts
// FocusFlow — Real PostgreSQL Analytics Database Aggregation Integration Tests (Phase 9)
//
// Exercises true PostgreSQL database execution:
// 1. timezone(...) conversions and local calendar day boundaries
// 2. EXTRACT(ISODOW FROM ...) canonical 0..6 Monday-first weekday bucketing
// 3. EXTRACT(HOUR FROM ...) 0..23 hour of day grouping
// 4. COUNT(DISTINCT DATE(...)) active calendar days
// 5. GROUP BY aggregations for projects and temporal bins
// 6. Parameterized $queryRaw execution against PostgreSQL engine
// 7. Large project cardinality (N >= 26) with zero truncation or row loss
// 8. Strict multi-tenant isolation between User A and User B
// 9. Timezone-sensitive grouping across UTC, Asia/Kolkata, America/New_York, Europe/London, Pacific/Auckland
// 10. DST transition handling

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ep from 'embedded-postgres';
import path from 'path';
import { execSync } from 'child_process';
import {
  getAnalyticsOverviewAggregates,
  getWeekdayFocusAggregates,
  getHourlyFocusAggregates,
} from '../analytics';
import { getProjectProductivityAggregates } from '../productivity';
import { fillWeekdayBuckets, fillHourlyBuckets } from '@/domain/analytics';
import { prisma } from '../client';

interface EmbeddedPostgresInstance {
  start(): Promise<void>;
  initialise(): Promise<void>;
  createDatabase(name: string): Promise<void>;
  stop(): Promise<void>;
}

interface EmbeddedPostgresConstructor {
  new (options: {
    port: number;
    user: string;
    password: string;
    databaseDir: string;
    persistent?: boolean;
    createPostgresUser?: boolean;
    onLog?: (msg: string) => void;
    onError?: (err: unknown) => void;
  }): EmbeddedPostgresInstance;
}

const EmbeddedPostgresClass = (
  typeof ep === 'function'
    ? ep
    : (ep as unknown as { default: EmbeddedPostgresConstructor }).default
) as EmbeddedPostgresConstructor;

let pgInstance: EmbeddedPostgresInstance | null = null;

describe('Analytics Database Aggregation Layer (Real PostgreSQL Engine)', () => {
  const userAlice = 'usr_alice_analytics_real';
  const userBob = 'usr_bob_analytics_real';
  const timezoneNY = 'America/New_York';
  const timezoneIST = 'Asia/Kolkata';
  const timezoneUTC = 'UTC';
  const timezoneLondon = 'Europe/London';
  const timezoneAuckland = 'Pacific/Auckland';

  const startUtc = new Date('2026-09-14T00:00:00.000Z');
  const endUtcExclusive = new Date('2026-09-21T00:00:00.000Z');

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:password@localhost:5433/focusflow_test?schema=public';
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;

    if (!process.env.TEST_DATABASE_URL) {
      const dataDir = path.resolve(process.cwd(), '.test-pg-data');
      pgInstance = new EmbeddedPostgresClass({
        port: 5433,
        user: 'postgres',
        password: 'password',
        databaseDir: dataDir,
        persistent: true,
        createPostgresUser: false,
        onLog: () => {},
        onError: () => {},
      });

      try {
        await pgInstance.start();
      } catch {
        try {
          await pgInstance.initialise();
          await pgInstance.start();
        } catch {
          // May already be initialized and running
        }
      }

      try {
        await pgInstance.createDatabase('focusflow_test');
      } catch {
        // Database may already exist
      }
    }

    // Sync schema to PostgreSQL test database
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl },
      stdio: 'ignore',
    });

    await prisma.$connect();
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    if (pgInstance) {
      try {
        await pgInstance.stop();
      } catch {
        // Ignore stop errors on test exit
      }
    }
  }, 30000);

  beforeEach(async () => {
    // Clean tables in foreign-key dependency order
    await prisma.focusSession.deleteMany();
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Seed test users
    await prisma.user.createMany({
      data: [
        {
          id: userAlice,
          email: 'alice@example.com',
          name: 'Alice Analytics',
          timezone: timezoneNY,
        },
        {
          id: userBob,
          email: 'bob@example.com',
          name: 'Bob MultiTenant',
          timezone: timezoneNY,
        },
      ],
    });
  });

  describe('1. Overview Aggregations & Multi-Tenant Partitioning', () => {
    it('executes real PostgreSQL aggregations for counts, durations, longest session, and active days', async () => {
      // Alice's sessions
      await prisma.focusSession.createMany({
        data: [
          // Completed Focus 1: Tuesday 14:00 UTC (10:00 EDT)
          {
            id: 'ses_alice_1',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1500,
            actualDuration: 1500,
            startedAt: new Date('2026-09-15T14:00:00.000Z'),
            endedAt: new Date('2026-09-15T14:25:00.000Z'),
          },
          // Completed Focus 2: Tuesday 16:00 UTC (12:00 EDT) -> same local day (2026-09-15)
          {
            id: 'ses_alice_2',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1800,
            actualDuration: 1800,
            startedAt: new Date('2026-09-15T16:00:00.000Z'),
            endedAt: new Date('2026-09-15T16:30:00.000Z'),
          },
          // Completed Focus 3: Thursday 14:00 UTC (10:00 EDT) -> distinct local day (2026-09-17)
          {
            id: 'ses_alice_3',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 2400,
            actualDuration: 2400,
            startedAt: new Date('2026-09-17T14:00:00.000Z'),
            endedAt: new Date('2026-09-17T14:40:00.000Z'),
          },
          // Abandoned Focus: 600s
          {
            id: 'ses_alice_4',
            userId: userAlice,
            type: 'FOCUS',
            status: 'ABANDONED',
            plannedDuration: 1500,
            actualDuration: 600,
            startedAt: new Date('2026-09-16T10:00:00.000Z'),
            endedAt: new Date('2026-09-16T10:10:00.000Z'),
          },
          // Skipped Focus
          {
            id: 'ses_alice_5',
            userId: userAlice,
            type: 'FOCUS',
            status: 'SKIPPED',
            plannedDuration: 1500,
            actualDuration: 0,
            startedAt: new Date('2026-09-16T11:00:00.000Z'),
            endedAt: new Date('2026-09-16T11:00:00.000Z'),
          },
          // Completed Short Break: 300s
          {
            id: 'ses_alice_6',
            userId: userAlice,
            type: 'SHORT_BREAK',
            status: 'COMPLETED',
            plannedDuration: 300,
            actualDuration: 300,
            startedAt: new Date('2026-09-15T14:25:00.000Z'),
            endedAt: new Date('2026-09-15T14:30:00.000Z'),
          },
          // In Progress Focus: should not contribute to completed/abandoned
          {
            id: 'ses_alice_7',
            userId: userAlice,
            type: 'FOCUS',
            status: 'IN_PROGRESS',
            plannedDuration: 1500,
            actualDuration: null,
            startedAt: new Date('2026-09-18T10:00:00.000Z'),
          },
        ],
      });

      // Bob's sessions (cross-tenant verification)
      await prisma.focusSession.createMany({
        data: [
          {
            id: 'ses_bob_1',
            userId: userBob,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 3000,
            actualDuration: 3000,
            startedAt: new Date('2026-09-15T15:00:00.000Z'),
            endedAt: new Date('2026-09-15T15:50:00.000Z'),
          },
        ],
      });

      // Execute Alice's query
      const aliceOverview = await getAnalyticsOverviewAggregates(
        userAlice,
        startUtc,
        endUtcExclusive,
        timezoneNY
      );

      // Verify Alice calculations against PostgreSQL
      expect(aliceOverview.completedFocusSeconds).toBe(5700); // 1500 + 1800 + 2400
      expect(aliceOverview.completedFocusSessions).toBe(3);
      expect(aliceOverview.abandonedFocusSeconds).toBe(600);
      expect(aliceOverview.abandonedFocusSessions).toBe(1);
      expect(aliceOverview.longestCompletedSessionSeconds).toBe(2400);
      expect(aliceOverview.totalBreakSeconds).toBe(300);
      expect(aliceOverview.totalSessions).toBe(7);

      // Active focus days in NY: 2026-09-15 and 2026-09-17 = exactly 2 days
      expect(aliceOverview.activeFocusDays).toBe(2);

      // Verify Bob's query (Strict Multi-Tenant Isolation)
      const bobOverview = await getAnalyticsOverviewAggregates(
        userBob,
        startUtc,
        endUtcExclusive,
        timezoneNY
      );

      expect(bobOverview.completedFocusSeconds).toBe(3000);
      expect(bobOverview.completedFocusSessions).toBe(1);
      expect(bobOverview.abandonedFocusSeconds).toBe(0);
      expect(bobOverview.abandonedFocusSessions).toBe(0);
      expect(bobOverview.totalBreakSeconds).toBe(0);
      expect(bobOverview.totalSessions).toBe(1);
      expect(bobOverview.activeFocusDays).toBe(1);
    });
  });

  describe('2. Weekday Distribution (0..6 Monday-First) & Zero-Filling', () => {
    it('groups sessions by ISODOW in user timezone and fills missing weekdays', async () => {
      // Alice completed sessions:
      // Session 1: Tuesday 2026-09-15 14:00 UTC (10:00 EDT) -> Weekday = 1 (Tue), 1500s
      // Session 2: Tuesday 2026-09-15 16:00 UTC (12:00 EDT) -> Weekday = 1 (Tue), 1800s
      // Session 3: Thursday 2026-09-17 14:00 UTC (10:00 EDT) -> Weekday = 3 (Thu), 2400s
      await prisma.focusSession.createMany({
        data: [
          {
            id: 'ses_w1',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1500,
            actualDuration: 1500,
            startedAt: new Date('2026-09-15T14:00:00.000Z'),
          },
          {
            id: 'ses_w2',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1800,
            actualDuration: 1800,
            startedAt: new Date('2026-09-15T16:00:00.000Z'),
          },
          {
            id: 'ses_w3',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 2400,
            actualDuration: 2400,
            startedAt: new Date('2026-09-17T14:00:00.000Z'),
          },
        ],
      });

      const rawWeekdays = await getWeekdayFocusAggregates(
        userAlice,
        startUtc,
        endUtcExclusive,
        timezoneNY
      );

      // Raw engine aggregates only return active weekday rows
      expect(rawWeekdays).toHaveLength(2);

      const tuesdayRaw = rawWeekdays.find((w) => w.weekday === 1);
      expect(tuesdayRaw).toBeDefined();
      expect(tuesdayRaw?.seconds).toBe(3300); // 1500 + 1800
      expect(tuesdayRaw?.count).toBe(2);

      const thursdayRaw = rawWeekdays.find((w) => w.weekday === 3);
      expect(thursdayRaw).toBeDefined();
      expect(thursdayRaw?.seconds).toBe(2400);
      expect(thursdayRaw?.count).toBe(1);

      // Apply canonical domain zero-filling
      const filledWeekdays = fillWeekdayBuckets(rawWeekdays);
      expect(filledWeekdays).toHaveLength(7);

      // Mon (0) should be 0
      expect(filledWeekdays[0].weekday).toBe(0);
      expect(filledWeekdays[0].label).toBe('Mon');
      expect(filledWeekdays[0].completedFocusSeconds).toBe(0);
      expect(filledWeekdays[0].completedSessions).toBe(0);

      // Tue (1) should have data
      expect(filledWeekdays[1].weekday).toBe(1);
      expect(filledWeekdays[1].label).toBe('Tue');
      expect(filledWeekdays[1].completedFocusSeconds).toBe(3300);
      expect(filledWeekdays[1].completedSessions).toBe(2);

      // Thu (3) should have data
      expect(filledWeekdays[3].weekday).toBe(3);
      expect(filledWeekdays[3].label).toBe('Thu');
      expect(filledWeekdays[3].completedFocusSeconds).toBe(2400);
      expect(filledWeekdays[3].completedSessions).toBe(1);

      // Sun (6) should be 0
      expect(filledWeekdays[6].weekday).toBe(6);
      expect(filledWeekdays[6].label).toBe('Sun');
      expect(filledWeekdays[6].completedFocusSeconds).toBe(0);
    });
  });

  describe('3. Hourly Distribution (0..23) & Zero-Filling', () => {
    it('groups sessions by local hour in user timezone and zero-fills 24 buckets', async () => {
      // In America/New_York (UTC-4 in Sep):
      // 14:00 UTC -> 10:00 EDT (Hour 10)
      // 16:00 UTC -> 12:00 EDT (Hour 12)
      await prisma.focusSession.createMany({
        data: [
          {
            id: 'ses_h1',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1500,
            actualDuration: 1500,
            startedAt: new Date('2026-09-15T14:00:00.000Z'),
          },
          {
            id: 'ses_h2',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1800,
            actualDuration: 1800,
            startedAt: new Date('2026-09-16T14:00:00.000Z'),
          },
          {
            id: 'ses_h3',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 2400,
            actualDuration: 2400,
            startedAt: new Date('2026-09-17T16:00:00.000Z'),
          },
        ],
      });

      const rawHourly = await getHourlyFocusAggregates(
        userAlice,
        startUtc,
        endUtcExclusive,
        timezoneNY
      );

      // PostgreSQL engine returns only active hours
      expect(rawHourly).toHaveLength(2);

      const hour10 = rawHourly.find((h) => h.hour === 10);
      expect(hour10).toBeDefined();
      expect(hour10?.seconds).toBe(3300); // 1500 + 1800
      expect(hour10?.count).toBe(2);

      const hour12 = rawHourly.find((h) => h.hour === 12);
      expect(hour12).toBeDefined();
      expect(hour12?.seconds).toBe(2400);
      expect(hour12?.count).toBe(1);

      // Apply canonical domain zero-filling
      const filledHourly = fillHourlyBuckets(rawHourly);
      expect(filledHourly).toHaveLength(24);

      // Hour 0 should be zero-filled
      expect(filledHourly[0].hour).toBe(0);
      expect(filledHourly[0].label).toBe('00:00');
      expect(filledHourly[0].completedFocusSeconds).toBe(0);

      // Hour 10 populated
      expect(filledHourly[10].hour).toBe(10);
      expect(filledHourly[10].label).toBe('10:00');
      expect(filledHourly[10].completedFocusSeconds).toBe(3300);
      expect(filledHourly[10].completedSessions).toBe(2);

      // Hour 12 populated
      expect(filledHourly[12].hour).toBe(12);
      expect(filledHourly[12].label).toBe('12:00');
      expect(filledHourly[12].completedFocusSeconds).toBe(2400);
      expect(filledHourly[12].completedSessions).toBe(1);

      // Hour 23 zero-filled
      expect(filledHourly[23].hour).toBe(23);
      expect(filledHourly[23].label).toBe('23:00');
      expect(filledHourly[23].completedFocusSeconds).toBe(0);
    });
  });

  describe('4. Project Grouping & Large Cardinality (N >= 26)', () => {
    it('aggregates duration and sessions across 25 distinct projects plus Unassigned without loss', async () => {
      const PROJECT_COUNT = 25;
      const projectData = [];

      for (let i = 1; i <= PROJECT_COUNT; i++) {
        const num = String(i).padStart(2, '0');
        projectData.push({
          id: `prj_perf_${num}`,
          userId: userAlice,
          name: `Project ${num}`,
          color: '#6366f1',
        });
      }

      await prisma.project.createMany({ data: projectData });

      // Seed 1 completed session for each project (25 sessions)
      const sessionData: Array<{
        id: string;
        userId: string;
        projectId: string | null;
        type: 'FOCUS';
        status: 'COMPLETED' | 'ABANDONED';
        plannedDuration: number;
        actualDuration: number;
        startedAt: Date;
        endedAt: Date;
      }> = projectData.map((p, idx) => ({
        id: `ses_proj_${idx + 1}`,
        userId: userAlice,
        projectId: p.id,
        type: 'FOCUS' as const,
        status: 'COMPLETED' as const,
        plannedDuration: 1800,
        actualDuration: 1800,
        startedAt: new Date('2026-09-15T10:00:00.000Z'),
        endedAt: new Date('2026-09-15T10:30:00.000Z'),
      }));

      // Seed 1 unassigned completed session (projectId = null)
      sessionData.push({
        id: 'ses_proj_unassigned',
        userId: userAlice,
        projectId: null,
        type: 'FOCUS' as const,
        status: 'COMPLETED' as const,
        plannedDuration: 1800,
        actualDuration: 1800,
        startedAt: new Date('2026-09-15T11:00:00.000Z'),
        endedAt: new Date('2026-09-15T11:30:00.000Z'),
      });

      // Seed 1 abandoned session on prj_perf_01
      sessionData.push({
        id: 'ses_proj_abandoned',
        userId: userAlice,
        projectId: 'prj_perf_01',
        type: 'FOCUS' as const,
        status: 'ABANDONED' as const,
        plannedDuration: 1800,
        actualDuration: 600,
        startedAt: new Date('2026-09-16T10:00:00.000Z'),
        endedAt: new Date('2026-09-16T10:10:00.000Z'),
      });

      await prisma.focusSession.createMany({ data: sessionData });

      // Execute PostgreSQL project aggregation
      const projectAggs = await getProjectProductivityAggregates(
        userAlice,
        startUtc,
        endUtcExclusive
      );

      // Verify total groups: 25 projects + 1 Unassigned = 26 groups (N >= 26)
      expect(projectAggs).toHaveLength(26);

      // Check Unassigned group
      const unassignedGroup = projectAggs.find((p) => p.projectId === null);
      expect(unassignedGroup).toBeDefined();
      expect(unassignedGroup?.completedFocusSeconds).toBe(1800);
      expect(unassignedGroup?.completedFocusSessions).toBe(1);
      expect(unassignedGroup?.totalSessions).toBe(1);

      // Check prj_perf_01 (has 1 completed + 1 abandoned = 2 total sessions)
      const p1 = projectAggs.find((p) => p.projectId === 'prj_perf_01');
      expect(p1).toBeDefined();
      expect(p1?.completedFocusSeconds).toBe(1800);
      expect(p1?.completedFocusSessions).toBe(1);
      expect(p1?.totalSessions).toBe(2);

      // Check remaining 24 projects
      for (let i = 2; i <= PROJECT_COUNT; i++) {
        const num = String(i).padStart(2, '0');
        const p = projectAggs.find((item) => item.projectId === `prj_perf_${num}`);
        expect(p).toBeDefined();
        expect(p?.completedFocusSeconds).toBe(1800);
        expect(p?.completedFocusSessions).toBe(1);
        expect(p?.totalSessions).toBe(1);
      }
    });
  });

  describe('5. Timezone-Sensitive Grouping Across Offsets', () => {
    it('accurately converts weekdays and hours across UTC, Kolkata, New York, London, and Auckland', async () => {
      // Session recorded at 2026-09-15 23:30:00 UTC (Tuesday night)
      await prisma.focusSession.create({
        data: {
          id: 'ses_tz_1',
          userId: userAlice,
          type: 'FOCUS',
          status: 'COMPLETED',
          plannedDuration: 1800,
          actualDuration: 1800,
          startedAt: new Date('2026-09-15T23:30:00.000Z'),
          endedAt: new Date('2026-09-16T00:00:00.000Z'),
        },
      });

      // 1. UTC: Tuesday 23:30 -> Weekday = 1 (Tue), Hour = 23
      const utcW = await getWeekdayFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneUTC);
      const utcH = await getHourlyFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneUTC);
      const utcO = await getAnalyticsOverviewAggregates(userAlice, startUtc, endUtcExclusive, timezoneUTC);

      expect(utcW[0].weekday).toBe(1);
      expect(utcH[0].hour).toBe(23);
      expect(utcO.activeFocusDays).toBe(1);

      // 2. America/New_York (UTC-4 EDT): Tuesday 19:30 -> Weekday = 1 (Tue), Hour = 19
      const nyW = await getWeekdayFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneNY);
      const nyH = await getHourlyFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneNY);
      const nyO = await getAnalyticsOverviewAggregates(userAlice, startUtc, endUtcExclusive, timezoneNY);

      expect(nyW[0].weekday).toBe(1);
      expect(nyH[0].hour).toBe(19);
      expect(nyO.activeFocusDays).toBe(1);

      // 3. Asia/Kolkata (UTC+5:30): Wednesday 05:00 IST -> Weekday = 2 (Wed), Hour = 5
      const istW = await getWeekdayFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneIST);
      const istH = await getHourlyFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneIST);
      const istO = await getAnalyticsOverviewAggregates(userAlice, startUtc, endUtcExclusive, timezoneIST);

      expect(istW[0].weekday).toBe(2);
      expect(istH[0].hour).toBe(5);
      expect(istO.activeFocusDays).toBe(1);

      // 4. Europe/London (UTC+1 BST): Wednesday 00:30 BST -> Weekday = 2 (Wed), Hour = 0
      const lonW = await getWeekdayFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneLondon);
      const lonH = await getHourlyFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneLondon);
      const lonO = await getAnalyticsOverviewAggregates(userAlice, startUtc, endUtcExclusive, timezoneLondon);

      expect(lonW[0].weekday).toBe(2);
      expect(lonH[0].hour).toBe(0);
      expect(lonO.activeFocusDays).toBe(1);

      // 5. Pacific/Auckland (UTC+12 NZST): Wednesday 11:30 NZST -> Weekday = 2 (Wed), Hour = 11
      const auckW = await getWeekdayFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneAuckland);
      const auckH = await getHourlyFocusAggregates(userAlice, startUtc, endUtcExclusive, timezoneAuckland);
      const auckO = await getAnalyticsOverviewAggregates(userAlice, startUtc, endUtcExclusive, timezoneAuckland);

      expect(auckW[0].weekday).toBe(2);
      expect(auckH[0].hour).toBe(11);
      expect(auckO.activeFocusDays).toBe(1);
    });
  });

  describe('6. Daylight Saving Time (DST) Transition Handling', () => {
    it('correctly groups sessions crossing Fall-Back DST transitions in local time', async () => {
      // In America/New_York, DST ends on Sunday, Nov 1, 2026 at 02:00 EDT (turning back to 01:00 EST).
      // Session A (before transition): 2026-11-01 05:30 UTC -> 01:30 EDT (UTC-4) -> Hour 1
      // Session B (after transition):  2026-11-01 06:30 UTC -> 01:30 EST (UTC-5) -> Hour 1
      const dstStartUtc = new Date('2026-11-01T00:00:00.000Z');
      const dstEndUtcExclusive = new Date('2026-11-02T00:00:00.000Z');

      await prisma.focusSession.createMany({
        data: [
          {
            id: 'ses_dst_before',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1800,
            actualDuration: 1800,
            startedAt: new Date('2026-11-01T05:30:00.000Z'),
            endedAt: new Date('2026-11-01T06:00:00.000Z'),
          },
          {
            id: 'ses_dst_after',
            userId: userAlice,
            type: 'FOCUS',
            status: 'COMPLETED',
            plannedDuration: 1800,
            actualDuration: 1800,
            startedAt: new Date('2026-11-01T06:30:00.000Z'),
            endedAt: new Date('2026-11-01T07:00:00.000Z'),
          },
        ],
      });

      const dstHours = await getHourlyFocusAggregates(
        userAlice,
        dstStartUtc,
        dstEndUtcExclusive,
        timezoneNY
      );

      // Both sessions belong to Hour 1 in New York local clock time!
      expect(dstHours).toHaveLength(1);
      expect(dstHours[0].hour).toBe(1);
      expect(dstHours[0].seconds).toBe(3600); // 1800 + 1800
      expect(dstHours[0].count).toBe(2);

      // Both belong to Sunday (weekday 6)
      const dstWeekdays = await getWeekdayFocusAggregates(
        userAlice,
        dstStartUtc,
        dstEndUtcExclusive,
        timezoneNY
      );
      expect(dstWeekdays).toHaveLength(1);
      expect(dstWeekdays[0].weekday).toBe(6); // Sunday
      expect(dstWeekdays[0].seconds).toBe(3600);
      expect(dstWeekdays[0].count).toBe(2);

      // Active days is 1 (both on Sunday Nov 1)
      const dstOverview = await getAnalyticsOverviewAggregates(
        userAlice,
        dstStartUtc,
        dstEndUtcExclusive,
        timezoneNY
      );
      expect(dstOverview.activeFocusDays).toBe(1);
      expect(dstOverview.completedFocusSeconds).toBe(3600);
      expect(dstOverview.completedFocusSessions).toBe(2);
    });
  });
});
