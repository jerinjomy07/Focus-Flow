// src/lib/db/__tests__/notifications-db.test.ts
// FocusFlow — Real PostgreSQL Notifications Database Integration Tests (Phase 10)
//
// Exercises true PostgreSQL database execution:
// 1. Notification creation, pagination, newest-first ordering, and unread count
// 2. Idempotent markAsRead and markAllAsRead
// 3. Multi-tenant isolation and anti-enumeration security between User Alice and User Bob
// 4. Unique dedupeKey constraint enforcement and upsert idempotency
// 5. Transactional session completion + notification creation in completeFocusSession
// 6. Idempotency on repeated session completion (zero duplicate notifications)
// 7. NotificationPreference enforcement (disabled preference produces zero notifications)
// 8. Timezone update regression test: changing User.timezone preserves historical UTC instants

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ep from 'embedded-postgres';
import path from 'path';
import { execSync } from 'child_process';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../notifications';
import {
  createFocusSession,
  completeFocusSession,
} from '../sessions';
import { updateUser, getUserById } from '../users';
import { prisma } from '../client';
import { NotFoundError } from '@/lib/errors';

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

describe('Notifications Database Layer (Real PostgreSQL Engine)', () => {
  const userAlice = 'usr_alice_notifications_real';
  const userBob = 'usr_bob_notifications_real';
  const port = 5433;
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    `postgresql://postgres:password@localhost:${port}/focusflow_test?schema=public`;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;

    if (!process.env.TEST_DATABASE_URL) {
      const dataDir = path.resolve(process.cwd(), '.test-pg-data');
      pgInstance = new EmbeddedPostgresClass({
        port,
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
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.focusSession.deleteMany();
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.userSettings.deleteMany();
    await prisma.user.deleteMany();

    // Seed test users
    await prisma.user.createMany({
      data: [
        {
          id: userAlice,
          email: 'alice.notifications@example.com',
          name: 'Alice Notifications',
          timezone: 'UTC',
        },
        {
          id: userBob,
          email: 'bob.notifications@example.com',
          name: 'Bob Notifications',
          timezone: 'America/New_York',
        },
      ],
    });
  });

  describe('1. CRUD, Pagination, Ordering & Unread Count', () => {
    it('creates and paginates notifications sorted newest first', async () => {
      const now = Date.now();

      // Create 3 notifications for Alice with staggered timestamps
      await prisma.notification.create({
        data: {
          userId: userAlice,
          type: 'FOCUS_SESSION_COMPLETED',
          title: 'Session 1',
          body: 'First session done',
          dedupeKey: 'dedupe-1',
          createdAt: new Date(now - 3000),
        },
      });

      await prisma.notification.create({
        data: {
          userId: userAlice,
          type: 'FOCUS_SESSION_COMPLETED',
          title: 'Session 2',
          body: 'Second session done',
          dedupeKey: 'dedupe-2',
          createdAt: new Date(now - 2000),
        },
      });

      await prisma.notification.create({
        data: {
          userId: userAlice,
          type: 'FOCUS_SESSION_COMPLETED',
          title: 'Session 3',
          body: 'Third session done',
          dedupeKey: 'dedupe-3',
          createdAt: new Date(now - 1000),
        },
      });

      const page1 = await getNotifications(userAlice, { page: 1, pageSize: 2 });
      expect(page1.total).toBe(3);
      expect(page1.totalPages).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.unreadCount).toBe(3);
      expect(page1.notifications).toHaveLength(2);
      // Newest first: Session 3, then Session 2
      expect(page1.notifications[0].title).toBe('Session 3');
      expect(page1.notifications[1].title).toBe('Session 2');

      const page2 = await getNotifications(userAlice, { page: 2, pageSize: 2 });
      expect(page2.notifications).toHaveLength(1);
      expect(page2.notifications[0].title).toBe('Session 1');
      expect(page2.hasMore).toBe(false);
    });

    it('marks a single notification as read idempotently', async () => {
      const notif = await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Focus complete',
        body: 'Great work',
        dedupeKey: 'dedupe-read-test',
      });

      expect(notif.readAt).toBeNull();
      let unread = await getUnreadNotificationCount(userAlice);
      expect(unread).toBe(1);

      // Mark read
      const updated = await markNotificationAsRead(userAlice, notif.id);
      expect(updated.readAt).not.toBeNull();

      unread = await getUnreadNotificationCount(userAlice);
      expect(unread).toBe(0);

      // Idempotent repeat
      const repeated = await markNotificationAsRead(userAlice, notif.id);
      expect(repeated.readAt).toEqual(updated.readAt);
    });

    it('marks all notifications as read in bulk', async () => {
      await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Session A',
        body: 'A',
        dedupeKey: 'bulk-1',
      });
      await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Session B',
        body: 'B',
        dedupeKey: 'bulk-2',
      });

      expect(await getUnreadNotificationCount(userAlice)).toBe(2);

      const result = await markAllNotificationsAsRead(userAlice);
      expect(result.count).toBe(2);
      expect(await getUnreadNotificationCount(userAlice)).toBe(0);

      // Repeating returns count 0
      const repeat = await markAllNotificationsAsRead(userAlice);
      expect(repeat.count).toBe(0);
    });
  });

  describe('2. Multi-Tenant Isolation & Anti-Enumeration', () => {
    it('strictly isolates notifications between Alice and Bob', async () => {
      // Alice has 1 notification
      const aliceNotif = await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Alice session',
        body: 'Done',
        dedupeKey: 'alice-exclusive-1',
      });

      // Bob has 1 notification
      await createNotification({
        userId: userBob,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Bob session',
        body: 'Done',
        dedupeKey: 'bob-exclusive-1',
      });

      // Alice only sees her notifications
      const aliceResult = await getNotifications(userAlice);
      expect(aliceResult.total).toBe(1);
      expect(aliceResult.notifications[0].id).toBe(aliceNotif.id);
      expect(aliceResult.unreadCount).toBe(1);

      // Bob only sees his notifications
      const bobResult = await getNotifications(userBob);
      expect(bobResult.total).toBe(1);
      expect(bobResult.notifications[0].title).toBe('Bob session');
      expect(bobResult.unreadCount).toBe(1);

      // Bob cannot mark Alice's notification as read (anti-enumeration 404 NotFoundError)
      await expect(markNotificationAsRead(userBob, aliceNotif.id)).rejects.toThrow(NotFoundError);

      // Alice's unread count is completely unaffected
      expect(await getUnreadNotificationCount(userAlice)).toBe(1);
    });
  });

  describe('3. Dedupe Key Uniqueness Constraint', () => {
    it('enforces unique constraint and ensures upsert idempotency on dedupeKey', async () => {
      const dedupeKey = 'test-dedupe-unique-123';

      const n1 = await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Focus 1',
        body: 'Done',
        dedupeKey,
      });

      // Attempting duplicate insert with createNotification uses upsert: should return existing without error
      const n2 = await createNotification({
        userId: userAlice,
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Focus 1 Duplicate',
        body: 'Done duplicate',
        dedupeKey,
      });

      expect(n2.id).toBe(n1.id);

      // Direct Prisma create with identical dedupeKey must throw P2002
      await expect(
        prisma.notification.create({
          data: {
            userId: userAlice,
            type: 'FOCUS_SESSION_COMPLETED',
            title: 'Conflict',
            body: 'Conflict',
            dedupeKey,
          },
        })
      ).rejects.toThrow();

      // Confirm DB contains only 1 record with this dedupeKey
      const count = await prisma.notification.count({ where: { dedupeKey } });
      expect(count).toBe(1);
    });
  });

  describe('4. Transactional Session Completion & In-App Notification', () => {
    it('atomically creates FOCUS_SESSION_COMPLETED notification upon session completion', async () => {
      const session = await createFocusSession(userAlice, {
        type: 'FOCUS',
        plannedDuration: 1500, // 25 min
        startedAt: new Date(Date.now() - 1500 * 1000),
      });

      // Complete session
      const completed = await completeFocusSession(userAlice, session.id);

      expect(completed.status).toBe('COMPLETED');

      // Check notification created
      const notifs = await getNotifications(userAlice);
      expect(notifs.total).toBe(1);
      const n = notifs.notifications[0];
      expect(n.type).toBe('FOCUS_SESSION_COMPLETED');
      expect(n.title).toBe('Focus session completed');
      expect(n.body).toBe('Your 25-minute focus session has been completed.');
      expect(n.metadata).toEqual({ focusSessionId: session.id });
      expect(n.readAt).toBeNull();
    });

    it('is completely idempotent on repeated completeFocusSession calls', async () => {
      const session = await createFocusSession(userAlice, {
        type: 'FOCUS',
        plannedDuration: 1800, // 30 min
        startedAt: new Date(Date.now() - 1800 * 1000),
      });

      // First complete call
      await completeFocusSession(userAlice, session.id);

      // Repeated complete call (simulating retry or multi-tab race)
      await completeFocusSession(userAlice, session.id);

      // Check that only ONE notification exists
      const notifs = await getNotifications(userAlice);
      expect(notifs.total).toBe(1);
    });
  });

  describe('5. Notification Preference Enforcement', () => {
    it('creates zero notifications when focusSessionCompletion is disabled', async () => {
      // Disable focus session completion notifications for Alice
      await updateNotificationPreferences(userAlice, { focusSessionCompletion: false });
      const prefs = await getNotificationPreferences(userAlice);
      expect(prefs.focusSessionCompletion).toBe(false);

      // Start and complete session
      const session = await createFocusSession(userAlice, {
        type: 'FOCUS',
        plannedDuration: 1500,
        startedAt: new Date(Date.now() - 1500 * 1000),
      });

      const completed = await completeFocusSession(userAlice, session.id);

      expect(completed.status).toBe('COMPLETED');

      // Zero notifications should have been generated
      const notifs = await getNotifications(userAlice);
      expect(notifs.total).toBe(0);
      expect(await getUnreadNotificationCount(userAlice)).toBe(0);
    });
  });

  describe('6. Timezone Update Regression Test', () => {
    it('updates user timezone without altering historical UTC instants in database', async () => {
      const session = await createFocusSession(userAlice, {
        type: 'FOCUS',
        plannedDuration: 1500,
        startedAt: new Date('2026-09-17T10:00:00.000Z'),
      });

      await completeFocusSession(userAlice, session.id);

      const notifBefore = (await getNotifications(userAlice)).notifications[0];
      const sessionBefore = await prisma.focusSession.findUnique({ where: { id: session.id } });

      expect(sessionBefore?.startedAt.toISOString()).toBe('2026-09-17T10:00:00.000Z');

      // Update Alice's timezone to Asia/Kolkata
      await updateUser(userAlice, { timezone: 'Asia/Kolkata' });
      const updatedUser = await getUserById(userAlice);
      expect(updatedUser?.timezone).toBe('Asia/Kolkata');

      // Query records again: UTC timestamps MUST NOT have changed
      const sessionAfter = await prisma.focusSession.findUnique({ where: { id: session.id } });
      const notifAfter = (await getNotifications(userAlice)).notifications[0];

      expect(sessionAfter?.startedAt.toISOString()).toBe('2026-09-17T10:00:00.000Z');
      expect(notifAfter.createdAt.toISOString()).toBe(notifBefore.createdAt.toISOString());
    });
  });
});
