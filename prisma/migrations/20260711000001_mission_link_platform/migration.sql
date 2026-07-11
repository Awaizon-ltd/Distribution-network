-- Add link and platform fields to missions
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "platform" TEXT;

-- Add MISSION_AVAILABLE to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MISSION_AVAILABLE';
