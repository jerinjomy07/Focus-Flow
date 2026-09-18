-- FocusFlow — Phase 11: Performance Indexes
-- Adds two composite indexes to FocusSession for high-frequency query patterns.
--
-- Index 1: (userId, status, startedAt)
--   Optimizes the active session check: findFirst({ where: { userId, status: 'IN_PROGRESS' } })
--   This is the most frequent query in the application (timer operation and session recovery).
--   The existing @@index([userId, type, status]) puts `type` before `status`, which is
--   less selective for the active session check that only filters on status.
--
-- Index 2: (userId, taskId, startedAt)
--   Optimizes history queries filtered by both userId and taskId.
--   The existing @@index([taskId]) is a single-column index that does not cover the userId
--   tenant boundary, resulting in unindexed scans for per-user task history.

CREATE INDEX "FocusSession_userId_status_startedAt_idx"
  ON "FocusSession" ("userId", "status", "startedAt");

CREATE INDEX "FocusSession_userId_taskId_startedAt_idx"
  ON "FocusSession" ("userId", "taskId", "startedAt");
