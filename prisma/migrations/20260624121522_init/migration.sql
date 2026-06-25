-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('DAILY', 'WEEKLY', 'SOCIAL', 'COMMUNITY', 'REFERRAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('STARTED', 'COMPLETED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TWITTER', 'TELEGRAM', 'DISCORD');

-- CreateEnum
CREATE TYPE "SocialStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('ANNOUNCEMENT', 'UPDATE', 'PARTNERSHIP', 'COMMUNITY', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MISSION_COMPLETE', 'REFERRAL_REWARD', 'RANK_CHANGE', 'NEWS', 'ACHIEVEMENT', 'NODE_STATUS', 'LEVEL_UP', 'MILESTONE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('POINTS', 'BONUS_MULTIPLIER', 'ACHIEVEMENT_BADGE');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ONBOARDING', 'MISSIONS', 'REFERRALS', 'SOCIAL', 'SCORE', 'LEVEL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "ScoreSource" AS ENUM ('MISSION_DAILY', 'MISSION_WEEKLY', 'MISSION_SPECIAL', 'MISSION_COMMUNITY', 'MISSION_REFERRAL', 'MISSION_SOCIAL', 'REFERRAL_ACTIVATION', 'REFERRAL_MILESTONE', 'SOCIAL_CONNECT', 'ACHIEVEMENT', 'CHECK_IN', 'NODE_ACTIVATION', 'ADMIN', 'EVENT');

-- CreateEnum
CREATE TYPE "ReputationChangeReason" AS ENUM ('MISSION_COMPLETED', 'SOCIAL_CONNECTED', 'REFERRAL_VERIFIED', 'SUSPICIOUS_IP', 'FAKE_REFERRAL_DETECTED', 'ABUSE_DETECTED', 'ADMIN_ADJUSTMENT', 'ACCOUNT_ACTIVITY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_SUSPENDED', 'USER_BANNED', 'NODE_ACTIVATED', 'NODE_SUSPENDED', 'NODE_SCORE_ADDED', 'NODE_LEVEL_UP', 'MISSION_COMPLETED', 'MISSION_CLAIMED', 'REFERRAL_CREATED', 'REFERRAL_REWARDED', 'REFERRAL_MILESTONE_REACHED', 'POINTS_ADDED', 'POINTS_DEDUCTED', 'SOCIAL_CONNECTED', 'SOCIAL_DISCONNECTED', 'ACHIEVEMENT_UNLOCKED', 'REPUTATION_CHANGED', 'ADMIN_ACTION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalPoints" BIGINT NOT NULL DEFAULT 0,
    "weeklyPoints" BIGINT NOT NULL DEFAULT 0,
    "referralPoints" BIGINT NOT NULL DEFAULT 0,
    "globalRank" INTEGER,
    "weeklyRank" INTEGER,
    "referralRank" INTEGER,
    "nodeRank" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_nonces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'INACTIVE',
    "nodeScore" BIGINT NOT NULL DEFAULT 0,
    "nodeLevel" INTEGER NOT NULL DEFAULT 1,
    "nodeLevelTitle" TEXT NOT NULL DEFAULT 'Explorer',
    "nodeMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "nodeReputation" INTEGER NOT NULL DEFAULT 100,
    "missionScore" BIGINT NOT NULL DEFAULT 0,
    "referralScore" BIGINT NOT NULL DEFAULT 0,
    "achievementScore" BIGINT NOT NULL DEFAULT 0,
    "socialScore" BIGINT NOT NULL DEFAULT 0,
    "checkInScore" BIGINT NOT NULL DEFAULT 0,
    "eventScore" BIGINT NOT NULL DEFAULT 0,
    "nodeScoreRank" INTEGER,
    "reputationRank" INTEGER,
    "activatedAt" TIMESTAMP(3),
    "lastScoreAt" TIMESTAMP(3),
    "signatureHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_score_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeDbId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "ScoreSource" NOT NULL,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "newTotal" BIGINT NOT NULL,
    "multiplierAt" DECIMAL(4,2) NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_reputation_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeDbId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" "ReputationChangeReason" NOT NULL,
    "newScore" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_reputation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "points" INTEGER NOT NULL,
    "nodeScoreReward" INTEGER NOT NULL DEFAULT 20,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "scoreEarned" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "RewardType" NOT NULL DEFAULT 'POINTS',
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rewardIssued" BOOLEAN NOT NULL DEFAULT false,
    "rewardedAt" TIMESTAMP(3),
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "scoreEarned" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "platformUserId" TEXT,
    "username" TEXT,
    "status" "SocialStatus" NOT NULL DEFAULT 'PENDING',
    "verificationCode" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "tier" "AchievementTier" NOT NULL DEFAULT 'BRONZE',
    "iconUrl" TEXT,
    "pointReward" INTEGER NOT NULL DEFAULT 0,
    "scoreReward" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "scoreEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" "NewsCategory" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_totalPoints_idx" ON "users"("totalPoints" DESC);

-- CreateIndex
CREATE INDEX "users_weeklyPoints_idx" ON "users"("weeklyPoints" DESC);

-- CreateIndex
CREATE INDEX "users_referralPoints_idx" ON "users"("referralPoints" DESC);

-- CreateIndex
CREATE INDEX "users_globalRank_idx" ON "users"("globalRank");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "auth_nonces_nonce_idx" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "auth_nonces_userId_idx" ON "auth_nonces"("userId");

-- CreateIndex
CREATE INDEX "auth_nonces_expiresAt_idx" ON "auth_nonces"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_userId_key" ON "nodes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_nodeId_key" ON "nodes"("nodeId");

-- CreateIndex
CREATE INDEX "nodes_userId_idx" ON "nodes"("userId");

-- CreateIndex
CREATE INDEX "nodes_nodeId_idx" ON "nodes"("nodeId");

-- CreateIndex
CREATE INDEX "nodes_nodeScore_idx" ON "nodes"("nodeScore" DESC);

-- CreateIndex
CREATE INDEX "nodes_nodeLevel_idx" ON "nodes"("nodeLevel");

-- CreateIndex
CREATE INDEX "nodes_nodeReputation_idx" ON "nodes"("nodeReputation");

-- CreateIndex
CREATE INDEX "nodes_status_idx" ON "nodes"("status");

-- CreateIndex
CREATE INDEX "node_score_history_userId_idx" ON "node_score_history"("userId");

-- CreateIndex
CREATE INDEX "node_score_history_nodeDbId_idx" ON "node_score_history"("nodeDbId");

-- CreateIndex
CREATE INDEX "node_score_history_source_idx" ON "node_score_history"("source");

-- CreateIndex
CREATE INDEX "node_score_history_createdAt_idx" ON "node_score_history"("createdAt");

-- CreateIndex
CREATE INDEX "node_reputation_history_userId_idx" ON "node_reputation_history"("userId");

-- CreateIndex
CREATE INDEX "node_reputation_history_nodeDbId_idx" ON "node_reputation_history"("nodeDbId");

-- CreateIndex
CREATE INDEX "node_reputation_history_createdAt_idx" ON "node_reputation_history"("createdAt");

-- CreateIndex
CREATE INDEX "missions_type_idx" ON "missions"("type");

-- CreateIndex
CREATE INDEX "missions_status_idx" ON "missions"("status");

-- CreateIndex
CREATE INDEX "missions_startsAt_idx" ON "missions"("startsAt");

-- CreateIndex
CREATE INDEX "missions_endsAt_idx" ON "missions"("endsAt");

-- CreateIndex
CREATE INDEX "mission_completions_userId_idx" ON "mission_completions"("userId");

-- CreateIndex
CREATE INDEX "mission_completions_missionId_idx" ON "mission_completions"("missionId");

-- CreateIndex
CREATE INDEX "mission_completions_status_idx" ON "mission_completions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mission_completions_userId_missionId_key" ON "mission_completions"("userId", "missionId");

-- CreateIndex
CREATE INDEX "point_transactions_userId_idx" ON "point_transactions"("userId");

-- CreateIndex
CREATE INDEX "point_transactions_source_idx" ON "point_transactions"("source");

-- CreateIndex
CREATE INDEX "point_transactions_createdAt_idx" ON "point_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "referrals"("refereeId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_refereeId_idx" ON "referrals"("refereeId");

-- CreateIndex
CREATE INDEX "referrals_code_idx" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referrals_createdAt_idx" ON "referrals"("createdAt");

-- CreateIndex
CREATE INDEX "social_connections_userId_idx" ON "social_connections"("userId");

-- CreateIndex
CREATE INDEX "social_connections_platform_idx" ON "social_connections"("platform");

-- CreateIndex
CREATE INDEX "social_connections_platformUserId_idx" ON "social_connections"("platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_userId_platform_key" ON "social_connections"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "achievements_key_idx" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_status_idx" ON "news"("status");

-- CreateIndex
CREATE INDEX "news_category_idx" ON "news"("category");

-- CreateIndex
CREATE INDEX "news_publishedAt_idx" ON "news"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "news_slug_idx" ON "news"("slug");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- AddForeignKey
ALTER TABLE "auth_nonces" ADD CONSTRAINT "auth_nonces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_score_history" ADD CONSTRAINT "node_score_history_nodeDbId_fkey" FOREIGN KEY ("nodeDbId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_reputation_history" ADD CONSTRAINT "node_reputation_history_nodeDbId_fkey" FOREIGN KEY ("nodeDbId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_completions" ADD CONSTRAINT "mission_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_completions" ADD CONSTRAINT "mission_completions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
