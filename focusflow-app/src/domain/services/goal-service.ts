// src/domain/services/goal-service.ts
// FocusFlow — Goals Domain Service
// Evaluates active goals against real FocusSession records.

import * as db from '@/lib/db';
import { computeGoalProgress } from '@/domain/analytics';
import { NotFoundError } from '@/lib/errors';
import type { GoalWithProgress } from '@/types/domain';

export class GoalService {
  /**
   * Retrieves all active goals for a user with calculated progress.
   * Progress is derived dynamically from real session records.
   */
  static async getGoalsWithProgress(userId: string): Promise<GoalWithProgress[]> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const goals = await db.getGoalsByUserId(userId);
    if (goals.length === 0) return [];

    const now = new Date();
    const userTz = user.timezone;

    // Determine today's bounds in user timezone
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: userTz });
    const [year, month, day] = todayStr.split('-').map(Number);
    const startOfToday = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    // Determine start of this week (7 days ago)
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch sessions for today and this week
    const [todaySessions, weekSessions] = await Promise.all([
      db.getSessionsForPeriod(userId, startOfToday, now),
      db.getSessionsForPeriod(userId, startOfWeek, now),
    ]);

    return goals.map((goal) => {
      const sessions = goal.period === 'DAILY' ? todaySessions : weekSessions;
      const { progress, percentage } = computeGoalProgress(sessions, goal.type, goal.target);

      return {
        ...goal,
        progress,
        percentage,
      };
    });
  }
}
