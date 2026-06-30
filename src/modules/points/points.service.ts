import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { logger } from '../../utils/logger'

class PointsService {
  async addPoints(
    userId: string,
    amount: number,
    source: string,
    description: string,
    sourceId?: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.pointTransaction.create({
        data: { userId, amount, source, description, sourceId },
      })

      await tx.user.update({
        where: { id: userId },
        data: {
          totalPoints: { increment: amount },
          weeklyPoints: { increment: amount },
        },
      })

      if (source === 'REFERRAL') {
        await tx.user.update({
          where: { id: userId },
          data: { referralPoints: { increment: amount } },
        })
      }
    })

    // Invalidate leaderboard caches and user profile cache
    await Promise.all([
      redis.invalidatePattern('leaderboard:*'),
      redis.del(CACHE_KEYS.userById(userId)),
    ])

    logger.debug(`Added ${amount} points to user ${userId} from ${source}`)
  }

  async deductPoints(
    userId: string,
    amount: number,
    source: string,
    description: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { totalPoints: true } })
      const currentPoints = Number(user?.totalPoints ?? 0)
      const deductAmount = Math.min(amount, currentPoints)

      await tx.pointTransaction.create({
        data: { userId, amount: -deductAmount, source, description },
      })

      await tx.user.update({
        where: { id: userId },
        data: { totalPoints: { decrement: deductAmount } },
      })
    })

    await Promise.all([
      redis.invalidatePattern('leaderboard:*'),
      redis.del(CACHE_KEYS.userById(userId)),
    ])
  }
}

export const pointsService = new PointsService()
