// src/lib/db/notifications.ts
// FocusFlow — In-App Notifications Data Access Layer (Phase 10)
//
// Direct PostgreSQL database access for persistent in-app notifications and preferences.
// Strictly enforces multi-tenant isolation by scoping all queries to authenticated userId.
// Guarantees idempotency via database-level dedupeKey uniqueness.

import { prisma } from './client';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';
import type { Notification, NotificationPreference, NotificationType } from '@/types/domain';

export interface GetNotificationsOptions {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export interface PaginatedNotificationsResult {
  notifications: Notification[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  unreadCount: number;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
}

// Type representing a Prisma transaction or standard client
type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

/**
 * Retrieves paginated notifications for the authenticated user, newest first.
 * Concurrently calculates authoritative unread count without loading full history.
 */
export async function getNotifications(
  userId: string,
  options: GetNotificationsOptions = {}
): Promise<PaginatedNotificationsResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.NotificationWhereInput = {
    userId,
    ...(options.unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({
      where: whereClause,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasMore = page < totalPages;

  return {
    notifications: notifications as unknown as Notification[],
    total,
    totalPages,
    page,
    pageSize,
    hasMore,
    unreadCount,
  };
}

/**
 * Returns the exact unread notification count for a user.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

/**
 * Marks a single notification as read.
 * Validates ownership: returns 404 if notification not found or belongs to another user.
 * Idempotent: safe to call repeatedly on already-read notifications.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<Notification> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new NotFoundError('Notification');
  }

  if (notification.readAt !== null) {
    return notification as unknown as Notification;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return updated as unknown as Notification;
}

/**
 * Marks all unread notifications as read for the authenticated user.
 * Efficient database update affecting only the user's unread records.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

/**
 * Creates a notification within an optional transaction client.
 * Uses upsert on dedupeKey to guarantee strict idempotency.
 */
export async function createNotification(
  data: CreateNotificationInput,
  client: PrismaClientOrTx = prisma
): Promise<Notification> {
  if (data.dedupeKey) {
    const upserted = await client.notification.upsert({
      where: { dedupeKey: data.dedupeKey },
      create: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        metadata: data.metadata ?? Prisma.JsonNull,
        dedupeKey: data.dedupeKey,
      },
      update: {
        // No-op update on collision to guarantee idempotency without data mutation
      },
    });
    return upserted as unknown as Notification;
  }

  const created = await client.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      metadata: data.metadata ?? Prisma.JsonNull,
      dedupeKey: null,
    },
  });

  return created as unknown as Notification;
}

/**
 * Retrieves notification preferences for a user.
 * Defaults to { focusSessionCompletion: true } if not yet explicitly saved.
 */
export async function getNotificationPreferences(
  userId: string,
  client: PrismaClientOrTx = prisma
): Promise<NotificationPreference> {
  const pref = await client.notificationPreference.findUnique({
    where: { userId },
  });

  if (pref) {
    return pref;
  }

  return {
    id: `default_${userId}`,
    userId,
    focusSessionCompletion: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Updates notification preferences for a user.
 * Upserts to guarantee existence.
 */
export async function updateNotificationPreferences(
  userId: string,
  data: { focusSessionCompletion?: boolean },
  client: PrismaClientOrTx = prisma
): Promise<NotificationPreference> {
  return client.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      focusSessionCompletion: data.focusSessionCompletion ?? true,
    },
    update: {
      ...(data.focusSessionCompletion !== undefined && {
        focusSessionCompletion: data.focusSessionCompletion,
      }),
    },
  });
}