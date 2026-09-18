-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "FocusSession" ADD COLUMN "pausedAt" TIMESTAMP(3);

-- CreateIndex
-- Database-level Single Active Session Guarantee (ADR-014)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_session_per_user" ON "FocusSession"("userId") WHERE "status" = 'IN_PROGRESS';
