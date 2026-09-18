// prisma/seed.ts
// FocusFlow — Development Database Seed Script
// Populates the database with realistic sample data for local development.
// GUARDS AGAINST RUNNING IN PRODUCTION.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Database seeding is forbidden in production environment.');
    process.exit(1);
  }

  console.log('🌱 Seeding FocusFlow development database...');

  // 1. Clean existing development data (reverse dependency order)
  await prisma.focusSession.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log('  ✓ Cleaned existing development records');

  // 2. Hash default password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 3. Create Persona 1 — Alex (Developer)
  const alex = await prisma.user.create({
    data: {
      name: 'Alex Miller',
      email: 'alex@focusflow.app',
      passwordHash,
      timezone: 'America/New_York',
      onboardedAt: new Date(),
      settings: {
        create: {
          focusDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          sessionsBeforeLongBreak: 4,
          autoStartBreaks: false,
          autoStartFocus: false,
          soundEnabled: true,
          notificationsEnabled: true,
          theme: 'DARK',
        },
      },
    },
  });

  // 4. Create Persona 2 — Priya (Student) for multi-tenant isolation testing
  const priya = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'priya@focusflow.app',
      passwordHash,
      timezone: 'Asia/Kolkata',
      onboardedAt: new Date(),
      settings: {
        create: {
          focusDuration: 30,
          shortBreakDuration: 5,
          longBreakDuration: 20,
          sessionsBeforeLongBreak: 3,
          autoStartBreaks: true,
          autoStartFocus: false,
          soundEnabled: true,
          notificationsEnabled: true,
          theme: 'SYSTEM',
        },
      },
    },
  });

  // Create a project and task for Priya to test tenant isolation
  await prisma.project.create({
    data: {
      userId: priya.id,
      name: 'Distributed Algorithms Course',
      description: 'University coursework and exam preparation',
      color: '#ec4899',
      status: 'ACTIVE',
      tasks: {
        create: {
          userId: priya.id,
          title: 'Complete Raft Consensus Assignment',
          priority: 'HIGH',
          estimatedPomodoros: 6,
        },
      },
    },
  });

  console.log('  ✓ Created users: Alex Miller (NY) and Priya Patel (Kolkata)');

  // 5. Create Projects for Alex
  const projectPlatform = await prisma.project.create({
    data: {
      userId: alex.id,
      name: 'FocusFlow Platform',
      description: 'Core Next.js SaaS architecture and production engineering',
      color: '#6366f1', // Indigo
      status: 'ACTIVE',
    },
  });

  const projectResearch = await prisma.project.create({
    data: {
      userId: alex.id,
      name: 'Domain Architecture Research',
      description: 'Deep-dive into timestamp state machines and zero-drift timers',
      color: '#10b981', // Emerald
      status: 'ACTIVE',
    },
  });

  const projectLearning = await prisma.project.create({
    data: {
      userId: alex.id,
      name: 'TypeScript & Distributed Systems',
      description: 'Advanced patterns and system design books',
      color: '#f59e0b', // Amber
      status: 'ACTIVE',
    },
  });

  console.log('  ✓ Created 3 development projects for Alex');

  // 6. Create Tasks for Alex
  const taskTimer = await prisma.task.create({
    data: {
      userId: alex.id,
      projectId: projectPlatform.id,
      title: 'Implement Timestamp-Driven Timer Engine',
      description: 'Zero setInterval accumulation; purely deterministic calculations',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      estimatedPomodoros: 4,
      completedPomodoros: 2,
    },
  });

  const taskSchema = await prisma.task.create({
    data: {
      userId: alex.id,
      projectId: projectPlatform.id,
      title: 'Define PostgreSQL Schema & Constraints',
      description: 'Multi-tenant isolation, cascade rules, and query indexes',
      status: 'COMPLETED',
      priority: 'HIGH',
      estimatedPomodoros: 3,
      completedPomodoros: 3,
    },
  });

  const taskApi = await prisma.task.create({
    data: {
      userId: alex.id,
      projectId: projectPlatform.id,
      title: 'Implement Route Handlers & Zod Validation',
      description: 'REST API endpoints with uniform response envelopes',
      status: 'TODO',
      priority: 'HIGH',
      estimatedPomodoros: 5,
      completedPomodoros: 0,
    },
  });

  const taskBook = await prisma.task.create({
    data: {
      userId: alex.id,
      projectId: projectLearning.id,
      title: 'Read Designing Data-Intensive Applications Ch. 7',
      description: 'Transactions and serializability guarantees',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      estimatedPomodoros: 3,
      completedPomodoros: 1,
    },
  });

  console.log('  ✓ Created 4 tasks for Alex');

  // 7. Create 14-Day Focus Session History for Alex
  // This powers charts, streaks, and rollups with realistic data.
  const now = new Date();
  const sessionData = [];

  // Generate sessions across the past 5 consecutive days (creating an active 5-day streak)
  for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
    const sessionDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);

    // 2 to 4 completed focus sessions per day
    const sessionsToday = 2 + (dayOffset % 3);
    for (let s = 0; s < sessionsToday; s++) {
      const startedAt = new Date(sessionDate.getTime() + (s * 40 + 9 * 60) * 60 * 1000); // morning sessions
      const endedAt = new Date(startedAt.getTime() + 25 * 60 * 1000);

      const tasks = [taskTimer, taskBook, taskSchema];
      const projects = [projectPlatform, projectLearning, projectResearch];
      const selectedTask = tasks[s % tasks.length];
      const selectedProject = projects[s % projects.length];

      sessionData.push({
        userId: alex.id,
        taskId: selectedTask.id,
        projectId: selectedProject.id,
        type: 'FOCUS' as const,
        status: 'COMPLETED' as const,
        plannedDuration: 1500, // 25 min
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt,
        endedAt,
      });
    }

    // Add 1 short break per day
    const breakStart = new Date(sessionDate.getTime() + (10 * 60) * 60 * 1000);
    const breakEnd = new Date(breakStart.getTime() + 5 * 60 * 1000);
    sessionData.push({
      userId: alex.id,
      taskId: null,
      projectId: null,
      type: 'SHORT_BREAK' as const,
      status: 'COMPLETED' as const,
      plannedDuration: 300,
      actualDuration: 300,
      pausedDuration: 0,
      startedAt: breakStart,
      endedAt: breakEnd,
    });
  }

  // Add 1 abandoned session 2 days ago
  const abandonedStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000);
  sessionData.push({
    userId: alex.id,
    taskId: taskApi.id,
    projectId: projectPlatform.id,
    type: 'FOCUS' as const,
    status: 'ABANDONED' as const,
    plannedDuration: 1500,
    actualDuration: 620, // Abandoned after ~10 minutes
    pausedDuration: 60,
    startedAt: abandonedStart,
    endedAt: new Date(abandonedStart.getTime() + 680 * 1000),
  });

  await prisma.focusSession.createMany({
    data: sessionData,
  });

  console.log(`  ✓ Created ${sessionData.length} historical focus sessions (5-day streak established)`);

  // 8. Create Goals for Alex
  await prisma.goal.create({
    data: {
      userId: alex.id,
      type: 'POMODORO_COUNT',
      target: 6,
      period: 'DAILY',
      startDate: new Date(),
      isActive: true,
    },
  });

  await prisma.goal.create({
    data: {
      userId: alex.id,
      type: 'FOCUS_DURATION',
      target: 600, // 10 hours = 600 minutes
      period: 'WEEKLY',
      startDate: new Date(),
      isActive: true,
    },
  });

  console.log('  ✓ Created daily and weekly goals for Alex');
  console.log('✅ Seed complete! Ready for development testing.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
