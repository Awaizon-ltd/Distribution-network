import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import { NotFoundError } from '../../utils/errors'

class UsersService {
  async getProfile(userId: string) {
    const cached = await redis.get(CACHE_KEYS.userById(userId))
    if (cached) return cached

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        node: { select: { status: true, activatedAt: true } },
        socialConnections: { select: { platform: true, username: true, status: true } },
        _count: {
          select: {
            referralsMade: true,
            missions: { where: { status: 'CLAIMED' } },
            achievements: true,
          },
        },
      },
    })

    if (!user) throw new NotFoundError('User not found')
    await redis.set(CACHE_KEYS.userById(userId), user, config.cache.userTTL)
    return user
  }

  async getProfileByWallet(wallet: string) {
    const normalizedWallet = wallet.toLowerCase()
    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedWallet },
      include: {
        node: { select: { status: true, activatedAt: true } },
        socialConnections: { select: { platform: true, username: true, status: true } },
        _count: { select: { referralsMade: true } },
      },
    })
    if (!user) throw new NotFoundError('User not found')
    return user
  }

  async getActivity(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [transactions, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pointTransaction.count({ where: { userId } }),
    ])
    return { transactions, total }
  }

  async getStats(userId: string) {
    const [user, missionStats, achievementCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalPoints: true,
          weeklyPoints: true,
          referralPoints: true,
          globalRank: true,
          weeklyRank: true,
          referralRank: true,
        },
      }),
      prisma.missionCompletion.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      }),
      prisma.userAchievement.count({ where: { userId } }),
    ])

    if (!user) throw new NotFoundError('User not found')

    // globalRank is populated by the ranking worker every 5 min.
    // Fall back to a live count if the worker hasn't run yet.
    let globalRank = user.globalRank
    if (globalRank === null) {
      const usersAhead = await prisma.user.count({
        where: { status: 'ACTIVE', totalPoints: { gt: user.totalPoints } },
      })
      globalRank = usersAhead + 1
    }

    return {
      points: {
        total: user.totalPoints.toString(),
        weekly: user.weeklyPoints.toString(),
        referral: user.referralPoints.toString(),
      },
      ranks: {
        global: globalRank,
        weekly: user.weeklyRank,
        referral: user.referralRank,
      },
      missions: missionStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      achievements: achievementCount,
    }
  }

  async invalidateUserCache(userId: string, wallet?: string): Promise<void> {
    const keys = [CACHE_KEYS.userById(userId)]
    if (wallet) keys.push(CACHE_KEYS.user(wallet))
    await redis.del(...keys)
  }
}

export const usersService = new UsersService()
