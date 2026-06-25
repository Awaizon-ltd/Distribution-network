import { prisma } from '../../database/client'
import { addNotificationJob } from '../../queue'
import { pointsService } from '../points/points.service'
import { logger } from '../../utils/logger'
import { ACHIEVEMENT_DEFINITIONS, type AchievementDef } from './achievements.definitions'

class AchievementsService {
  // Run after every score-earning action — checks all unearned achievements
  async checkAndAwardAchievements(
    userId: string,
    context: { source: string; newScore?: number; level?: number },
  ): Promise<void> {
    try {
      const [allAchievements, userAchievements, node, missionCount, referralCount, socialCount] =
        await Promise.all([
          prisma.achievement.findMany({ where: { isActive: true } }),
          prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
          prisma.node.findUnique({ where: { userId }, select: { nodeScore: true, nodeLevel: true } }),
          prisma.missionCompletion.count({ where: { userId, status: 'CLAIMED' } }),
          prisma.referral.count({ where: { referrerId: userId, rewardIssued: true } }),
          prisma.socialConnection.count({ where: { userId, status: 'VERIFIED' } }),
        ])

      const earnedIds = new Set(userAchievements.map((ua) => ua.achievementId))
      const nodeScore = Number(node?.nodeScore ?? 0)
      const nodeLevel = node?.nodeLevel ?? 1

      for (const achievement of allAchievements) {
        if (earnedIds.has(achievement.id)) continue

        const qualifies = this.evaluateCondition(achievement, {
          missionCount,
          referralCount,
          socialCount,
          nodeScore,
          nodeLevel,
          source: context.source,
        })

        if (qualifies) {
          await this.awardAchievement(userId, achievement)
        }
      }
    } catch (err) {
      logger.error('Achievement check failed:', err)
    }
  }

  async getUserAchievements(userId: string) {
    return prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    })
  }

  async getAchievements() {
    return prisma.achievement.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { tier: 'asc' }] })
  }

  // Seed achievements from definitions — run once on startup / migration
  async seedAchievements(): Promise<void> {
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await prisma.achievement.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          title: def.title,
          description: def.description,
          category: def.category as never,
          tier: def.tier as never,
          pointReward: def.pointReward,
          scoreReward: def.scoreReward,
          condition: def.condition,
        },
        update: {
          title: def.title,
          description: def.description,
          pointReward: def.pointReward,
          scoreReward: def.scoreReward,
        },
      })
    }
    logger.info(`Seeded ${ACHIEVEMENT_DEFINITIONS.length} achievements`)
  }

  // Award a specific achievement by key (called from milestone logic)
  async awardByKey(userId: string, achievementKey: string): Promise<void> {
    const achievement = await prisma.achievement.findUnique({ where: { key: achievementKey } })
    if (!achievement) return

    const existing = await prisma.userAchievement.findFirst({
      where: { userId, achievementId: achievement.id },
    })
    if (existing) return

    await this.awardAchievement(userId, achievement)
  }

  private async awardAchievement(userId: string, achievement: { id: string; title: string; description: string; pointReward: number; scoreReward: number; tier: string }): Promise<void> {
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
        pointsEarned: achievement.pointReward,
        scoreEarned: achievement.scoreReward,
      },
    })

    // Award points
    if (achievement.pointReward > 0) {
      await pointsService.addPoints(
        userId,
        achievement.pointReward,
        'ACHIEVEMENT',
        `Achievement: ${achievement.title}`,
        achievement.id,
      )
    }

    // Award score bonus (via prisma direct update to avoid circular issue)
    if (achievement.scoreReward > 0) {
      const node = await prisma.node.findUnique({ where: { userId } })
      if (node) {
        const newScore = Number(node.nodeScore) + achievement.scoreReward
        await prisma.$transaction([
          prisma.node.update({
            where: { userId },
            data: {
              nodeScore: { increment: achievement.scoreReward },
              achievementScore: { increment: achievement.scoreReward },
            },
          }),
          prisma.nodeScoreHistory.create({
            data: {
              userId,
              nodeDbId: node.id,
              amount: achievement.scoreReward,
              source: 'ACHIEVEMENT',
              sourceId: achievement.id,
              description: `Achievement: ${achievement.title}`,
              newTotal: BigInt(newScore),
              multiplierAt: node.nodeMultiplier,
              pointsAwarded: achievement.pointReward,
            },
          }),
        ])
      }
    }

    await addNotificationJob({
      userId,
      type: 'ACHIEVEMENT',
      title: `Achievement Unlocked: ${achievement.title}`,
      message: achievement.description,
      data: { achievementId: achievement.id, tier: achievement.tier },
    })

    logger.info(`Achievement [${achievement.title}] awarded to user ${userId}`)
  }

  private evaluateCondition(
    achievement: { condition: unknown },
    ctx: {
      missionCount: number
      referralCount: number
      socialCount: number
      nodeScore: number
      nodeLevel: number
      source: string
    },
  ): boolean {
    const cond = achievement.condition as AchievementDef['condition']

    switch (cond.type) {
      case 'ONE_TIME':
        return ctx.source === cond.source
      case 'MISSION_COUNT':
        return ctx.missionCount >= (cond.threshold ?? 0)
      case 'REFERRAL_COUNT':
        return ctx.referralCount >= (cond.threshold ?? 0)
      case 'SOCIAL_COUNT':
        return ctx.socialCount >= (cond.threshold ?? 0)
      case 'SCORE_THRESHOLD':
        return ctx.nodeScore >= (cond.threshold ?? 0)
      case 'LEVEL_REACHED':
        return ctx.nodeLevel >= (cond.threshold ?? 0)
      default:
        return false
    }
  }
}

export const achievementsService = new AchievementsService()
