import { Decimal } from '@prisma/client/runtime/library'
import { verifyMessage } from 'viem'
import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors'
import { pointsService } from '../points/points.service'
import { addAchievementCheckJob, addNotificationJob, addReferralJob } from '../../queue'
import { logger } from '../../utils/logger'
import { generateNodeId } from './node.id'
import {
  getLevelForScore,
  getMultiplierForScore,
  calculateProgressToNextLevel,
  SCORE_VALUES,
  MIN_REPUTATION_FOR_REWARDS,
  REPUTATION_CHANGES,
  NODE_LEVELS,
} from './node.levels'
import type { ScoreSource, ReputationChangeReason } from '@prisma/client'

const CHECK_IN_STREAK_BASE = 20
const CHECK_IN_STREAK_STEP = 5
const CHECK_IN_STREAK_CAP = 50

// ─── Core Score Engine ────────────────────────────────────────────────────────

class NodesService {

  // Primary method: every score-earning action flows through here
  async addScore(
    userId: string,
    scoreAmount: number,
    source: ScoreSource,
    description: string,
    sourceId?: string,
  ): Promise<{ pointsAwarded: number; leveledUp: boolean; newLevel?: number }> {
    const node = await this.requireActiveNode(userId)
    const currentScore = Number(node.nodeScore)
    const currentMultiplier = Number(node.nodeMultiplier)

    // Calculate points = score × current multiplier (points are the "reward currency")
    const pointsAwarded = Math.round(scoreAmount * currentMultiplier)

    // Determine which sub-score bucket to increment
    const subScoreField = this.sourceToSubScore(source)

    // New total score
    const newTotalScore = currentScore + scoreAmount

    // Calculate new level & multiplier
    const newLevelData = getLevelForScore(newTotalScore)
    const newMultiplier = new Decimal(newLevelData.multiplier)
    const didLevelUp = newLevelData.level > node.nodeLevel

    // Persist: update node + create history in a single transaction
    await prisma.$transaction(async (tx) => {
      await tx.node.update({
        where: { id: node.id },
        data: {
          nodeScore: { increment: scoreAmount },
          [subScoreField]: { increment: scoreAmount },
          nodeLevel: newLevelData.level,
          nodeLevelTitle: newLevelData.title,
          nodeMultiplier: newMultiplier,
          lastScoreAt: new Date(),
        },
      })

      await tx.nodeScoreHistory.create({
        data: {
          userId,
          nodeDbId: node.id,
          amount: scoreAmount,
          source,
          sourceId,
          description,
          newTotal: BigInt(newTotalScore),
          multiplierAt: new Decimal(currentMultiplier),
          pointsAwarded,
        },
      })
    })

    // Award points to user balance
    await pointsService.addPoints(userId, pointsAwarded, source, description, sourceId)

    // Handle level-up
    if (didLevelUp) {
      await this.handleLevelUp(userId, node.id, newLevelData.level, newLevelData.title)
    }

    // Queue async achievement check
    await addAchievementCheckJob({ userId, source, newScore: newTotalScore })

    // Invalidate caches
    await Promise.all([
      redis.del(CACHE_KEYS.nodeByUser(userId)),
      redis.del(CACHE_KEYS.userById(userId)),
    ])

    return { pointsAwarded, leveledUp: didLevelUp, newLevel: didLevelUp ? newLevelData.level : undefined }
  }

  // ─── Node Activation ─────────────────────────────────────────────────────

  async activateNode(userId: string, walletAddress: string, signature: string): Promise<{ nodeId: string; nodeScoreResult?: { pointsAwarded: number; leveledUp: boolean; newLevel?: ReturnType<typeof getLevelForScore> } | null }> {
    const existing = await prisma.node.findUnique({ where: { userId } })

    if (existing?.status === 'ACTIVE') {
      throw new ConflictError('Node is already active')
    }

    if (existing?.status === 'SUSPENDED') {
      throw new ForbiddenError('Node is suspended. Contact support.')
    }

    // Verify signature
    const message = this.buildActivationMessage(walletAddress)
    const isValid = await verifyMessage({
      address: walletAddress.toLowerCase() as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    if (!isValid) throw new BadRequestError('Invalid activation signature')

    const signatureHash = Buffer.from(signature).toString('base64').slice(0, 64)
    const nodeId = existing?.nodeId ?? await generateNodeId()

    // Create or re-activate node
    const node = await prisma.node.upsert({
      where: { userId },
      create: {
        userId,
        nodeId,
        status: 'ACTIVE',
        activatedAt: new Date(),
        nodeScore: 0,
        nodeLevel: 1,
        nodeLevelTitle: 'Explorer',
        nodeMultiplier: new Decimal(1.0),
        nodeReputation: 100,
        signatureHash,
      },
      update: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        signatureHash,
      },
    })

    // Award activation score (only on first-ever activation)
    let nodeScoreResult: { pointsAwarded: number; leveledUp: boolean; newLevel?: ReturnType<typeof getLevelForScore> } | null = null
    if (!existing) {
      const scoreResult = await this.addScore(userId, SCORE_VALUES.NODE_ACTIVATION, 'NODE_ACTIVATION', 'Node activated', node.id)
      nodeScoreResult = { ...scoreResult, newLevel: scoreResult.leveledUp ? getLevelForScore(SCORE_VALUES.NODE_ACTIVATION) : undefined }
    }

    await addNotificationJob({
      userId,
      type: 'NODE_STATUS',
      title: 'Node Activated',
      message: `Your node ${nodeId} is now active. Start earning by completing missions.`,
      data: { nodeId },
    })

    // On first activation: queue referral reward if this user was referred
    if (!existing) {
      const pendingReferral = await prisma.referral.findFirst({
        where: { refereeId: userId, rewardIssued: false },
      })
      if (pendingReferral) {
        await addReferralJob({ referralId: pendingReferral.id })
      }
    }

    await redis.del(CACHE_KEYS.nodeByUser(userId))
    return { nodeId: node.nodeId, nodeScoreResult }
  }

  // ─── Check-in ─────────────────────────────────────────────────────────────

  async dailyCheckIn(userId: string): Promise<{ scoreEarned: number; pointsAwarded: number; leveledUp: boolean; newLevel?: { title: string; level: number }; streak: number }> {
    const node = await this.requireActiveNode(userId)

    // Enforce once-per-day
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const lastCheckIn = await prisma.nodeScoreHistory.findFirst({
      where: { nodeDbId: node.id, source: 'CHECK_IN', createdAt: { gte: startOfDay } },
    })
    if (lastCheckIn) throw new ConflictError('Already checked in today')

    // Streak continues only if the previous check-in was yesterday — otherwise it resets to day 1
    const yesterday = new Date(startOfDay)
    yesterday.setDate(yesterday.getDate() - 1)
    const checkedInYesterday = !!node.lastCheckInAt && node.lastCheckInAt >= yesterday && node.lastCheckInAt < startOfDay
    const newStreak = checkedInYesterday ? node.checkInStreak + 1 : 1
    const checkInScore = Math.min(CHECK_IN_STREAK_BASE + (newStreak - 1) * CHECK_IN_STREAK_STEP, CHECK_IN_STREAK_CAP)

    await prisma.node.update({
      where: { id: node.id },
      data: { checkInStreak: newStreak, lastCheckInAt: now },
    })

    const result = await this.addScore(userId, checkInScore, 'CHECK_IN', `Daily check-in (streak day ${newStreak})`)

    return {
      scoreEarned: checkInScore,
      pointsAwarded: result.pointsAwarded,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel ? getLevelForScore(Number(node.nodeScore) + checkInScore) : undefined,
      streak: newStreak,
    }
  }

  // ─── Reputation ───────────────────────────────────────────────────────────

  async adjustReputation(
    userId: string,
    change: number,
    reason: ReputationChangeReason,
    metadata?: object,
  ): Promise<void> {
    const node = await prisma.node.findUnique({ where: { userId } })
    if (!node) return

    const newReputation = Math.max(0, Math.min(100, node.nodeReputation + change))

    await prisma.$transaction([
      prisma.node.update({
        where: { id: node.id },
        data: { nodeReputation: newReputation },
      }),
      prisma.nodeReputationHistory.create({
        data: {
          userId,
          nodeDbId: node.id,
          change,
          reason,
          newScore: newReputation,
          metadata: metadata as never,
        },
      }),
    ])

    // Auto-suspend if reputation hits 0
    if (newReputation === 0) {
      await prisma.node.update({ where: { id: node.id }, data: { status: 'SUSPENDED' } })
      logger.warn(`Node auto-suspended for user ${userId} — reputation hit 0`)
    }

    await redis.del(CACHE_KEYS.nodeByUser(userId))
  }

  // ─── Read Methods ─────────────────────────────────────────────────────────

  async getNodeByUser(userId: string) {
    const cached = await redis.get(CACHE_KEYS.nodeByUser(userId))
    if (cached) return cached

    const node = await prisma.node.findUnique({ where: { userId } })
    if (node) await redis.set(CACHE_KEYS.nodeByUser(userId), node, config.cache.userTTL)
    return node
  }

  async getFullNodeProfile(userId: string) {
    const cached = await redis.get(CACHE_KEYS.nodeByUser(userId))
    if (cached) return cached

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    // All 3 queries in parallel — todayCheckIn uses userId so it doesn't need node.id first
    const [node, user, todayCheckIn] = await Promise.all([
      prisma.node.findUnique({
        where: { userId },
        include: {
          scoreHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { totalPoints: true } }),
      prisma.nodeScoreHistory.findFirst({
        where: { userId, source: 'CHECK_IN', createdAt: { gte: startOfDay } },
        select: { id: true },
      }),
    ])

    if (!node) return null

    const score = Number(node.nodeScore)
    const progress = calculateProgressToNextLevel(score)

    const profile = {
      ...node,
      nodeScore: score,
      nodeMultiplier: Number(node.nodeMultiplier),
      missionScore: Number(node.missionScore),
      referralScore: Number(node.referralScore),
      achievementScore: Number(node.achievementScore),
      socialScore: Number(node.socialScore),
      checkInScore: Number(node.checkInScore),
      eventScore: Number(node.eventScore),
      scoreHistory: node.scoreHistory.map((h) => ({
        ...h,
        newTotal: Number(h.newTotal),
        multiplierAt: Number(h.multiplierAt),
      })),
      canCheckIn: node.status === 'ACTIVE' && !todayCheckIn,
      currentLevelMinScore: progress.currentLevel.minScore,
      currentLevelMaxScore: progress.currentLevel.maxScore,
      nextLevelTitle: progress.nextLevel?.title ?? null,
      nextLevelMinScore: progress.nextLevel?.minScore ?? null,
      pointsBalance: user?.totalPoints?.toString() ?? '0',
      progress,
      levelData: progress.currentLevel,
      allLevels: NODE_LEVELS,
    }

    await redis.set(CACHE_KEYS.nodeByUser(userId), profile, 30)
    return profile
  }

  async getNodeScoreHistory(userId: string, page = 1, limit = 20) {
    const node = await prisma.node.findUnique({ where: { userId } })
    if (!node) return { history: [], total: 0 }

    const skip = (page - 1) * limit
    const [history, total] = await Promise.all([
      prisma.nodeScoreHistory.findMany({
        where: { nodeDbId: node.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.nodeScoreHistory.count({ where: { nodeDbId: node.id } }),
    ])
    return {
      history: history.map((h) => ({
        ...h,
        newTotal: Number(h.newTotal),
        multiplierAt: Number(h.multiplierAt),
      })),
      total,
    }
  }

  async getNodeActivationMessage(walletAddress: string): Promise<string> {
    return this.buildActivationMessage(walletAddress)
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async suspendNode(userId: string, adminId: string, reason: string): Promise<void> {
    await prisma.node.update({ where: { userId }, data: { status: 'SUSPENDED' } })
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'NODE_SUSPENDED', entity: 'Node', entityId: userId, metadata: { reason } },
    })
    await redis.del(CACHE_KEYS.nodeByUser(userId))
  }

  async reinstateNode(userId: string, adminId: string): Promise<void> {
    await prisma.node.update({ where: { userId }, data: { status: 'ACTIVE', nodeReputation: 50 } })
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'NODE_ACTIVATED', entity: 'Node', entityId: userId },
    })
    await redis.del(CACHE_KEYS.nodeByUser(userId))
  }

  // ─── Anti-abuse ───────────────────────────────────────────────────────────

  async detectReferralAbuse(referrerId: string, refereeIp?: string, referrerIp?: string): Promise<boolean> {
    if (!refereeIp || !referrerIp) return false

    // Same IP = self-referral or sock puppet
    if (refereeIp === referrerIp) {
      await this.adjustReputation(referrerId, REPUTATION_CHANGES.SUSPICIOUS_IP, 'SUSPICIOUS_IP', {
        refereeIp,
      })
      logger.warn(`Suspicious referral: same IP ${refereeIp} for user ${referrerId}`)
      return true
    }
    return false
  }

  async checkReputationForRewards(userId: string): Promise<boolean> {
    const node = await prisma.node.findUnique({
      where: { userId },
      select: { nodeReputation: true, status: true },
    })
    if (!node) return false
    if (node.status === 'SUSPENDED') return false
    return node.nodeReputation >= MIN_REPUTATION_FOR_REWARDS
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async requireActiveNode(userId: string) {
    const node = await prisma.node.findUnique({ where: { userId } })
    if (!node || node.status !== 'ACTIVE') {
      throw new BadRequestError('Node must be active to earn score. Activate your node first.')
    }
    return node
  }

  private async handleLevelUp(userId: string, nodeDbId: string, newLevel: number, newTitle: string): Promise<void> {
    logger.info(`User ${userId} leveled up to ${newTitle} (Level ${newLevel})`)

    await addNotificationJob({
      userId,
      type: 'LEVEL_UP',
      title: `Level Up! You are now ${newTitle}`,
      message: `Your node reached Level ${newLevel}. Your earning multiplier has increased.`,
      data: { level: newLevel, title: newTitle },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'NODE_LEVEL_UP',
        entity: 'Node',
        entityId: nodeDbId,
        metadata: { level: newLevel, title: newTitle },
      },
    })

    // Queue achievement check for level-based achievements
    await addAchievementCheckJob({ userId, source: 'NODE_ACTIVATION', newScore: 0, level: newLevel })
  }

  private sourceToSubScore(source: ScoreSource): string {
    const map: Partial<Record<ScoreSource, string>> = {
      MISSION_DAILY: 'missionScore',
      MISSION_WEEKLY: 'missionScore',
      MISSION_SPECIAL: 'missionScore',
      MISSION_COMMUNITY: 'missionScore',
      MISSION_REFERRAL: 'missionScore',
      MISSION_SOCIAL: 'missionScore',
      REFERRAL_ACTIVATION: 'referralScore',
      REFERRAL_MILESTONE: 'referralScore',
      SOCIAL_CONNECT: 'socialScore',
      CHECK_IN: 'checkInScore',
      NODE_ACTIVATION: 'missionScore', // activation counts as a mission-type score
      ACHIEVEMENT: 'achievementScore',
      EVENT: 'eventScore',
      ADMIN: 'eventScore',
    }
    return map[source] ?? 'eventScore'
  }

  buildActivationMessage(walletAddress: string): string {
    return `Activate Testnet Node\n\nWallet: ${walletAddress}\n\nBy signing this message, you are activating your Testnet node and agreeing to participate in the ecosystem.\n\nThis signature does not trigger a blockchain transaction or incur any gas fees.`
  }
}

export const nodesService = new NodesService()
