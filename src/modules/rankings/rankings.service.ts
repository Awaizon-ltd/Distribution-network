import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'

export interface LeaderboardEntry {
  rank: number
  userId: string
  walletAddress: string
  points: string
  nodeActive: boolean
}

export interface CreatorLeaderboardEntry {
  rank: number
  userId: string
  walletAddress: string
  twitterUsername: string | null
  creatorScore: string
  sharePct: number
  submissionCount: number
}

class RankingsService {
  async getGlobalLeaderboard(page = 1, limit = 50): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const cached = await redis.get<{ entries: LeaderboardEntry[]; total: number }>(CACHE_KEYS.leaderboardGlobal)
    if (cached && page === 1 && limit === 50) return cached

    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { totalPoints: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          walletAddress: true,
          totalPoints: true,
          globalRank: true,
          node: { select: { status: true } },
        },
      }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
    ])

    const entries: LeaderboardEntry[] = users.map((u, i) => ({
      rank: skip + i + 1,
      userId: u.id,
      walletAddress: u.walletAddress,
      points: u.totalPoints.toString(),
      nodeActive: u.node?.status === 'ACTIVE',
    }))

    if (page === 1 && limit === 50) {
      await redis.set(CACHE_KEYS.leaderboardGlobal, { entries, total }, config.cache.leaderboardTTL)
    }
    return { entries, total }
  }

  async getWeeklyLeaderboard(page = 1, limit = 50): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const cached = await redis.get<{ entries: LeaderboardEntry[]; total: number }>(CACHE_KEYS.leaderboardWeekly)
    if (cached && page === 1 && limit === 50) return cached

    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'ACTIVE', weeklyPoints: { gt: 0 } },
        orderBy: { weeklyPoints: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          walletAddress: true,
          weeklyPoints: true,
          weeklyRank: true,
          node: { select: { status: true } },
        },
      }),
      prisma.user.count({ where: { status: 'ACTIVE', weeklyPoints: { gt: 0 } } }),
    ])

    const entries: LeaderboardEntry[] = users.map((u, i) => ({
      rank: skip + i + 1,
      userId: u.id,
      walletAddress: u.walletAddress,
      points: u.weeklyPoints.toString(),
      nodeActive: u.node?.status === 'ACTIVE',
    }))

    if (page === 1 && limit === 50) {
      await redis.set(CACHE_KEYS.leaderboardWeekly, { entries, total }, config.cache.leaderboardTTL)
    }
    return { entries, total }
  }

  async getReferralLeaderboard(page = 1, limit = 50): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const cached = await redis.get<{ entries: LeaderboardEntry[]; total: number }>(CACHE_KEYS.leaderboardReferral)
    if (cached && page === 1 && limit === 50) return cached

    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'ACTIVE', referralPoints: { gt: 0 } },
        orderBy: { referralPoints: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          walletAddress: true,
          referralPoints: true,
          referralRank: true,
          node: { select: { status: true } },
        },
      }),
      prisma.user.count({ where: { status: 'ACTIVE', referralPoints: { gt: 0 } } }),
    ])

    const entries: LeaderboardEntry[] = users.map((u, i) => ({
      rank: skip + i + 1,
      userId: u.id,
      walletAddress: u.walletAddress,
      points: u.referralPoints.toString(),
      nodeActive: u.node?.status === 'ACTIVE',
    }))

    if (page === 1 && limit === 50) {
      await redis.set(CACHE_KEYS.leaderboardReferral, { entries, total }, config.cache.leaderboardTTL)
    }
    return { entries, total }
  }

  async getNodeScoreLeaderboard(page = 1, limit = 50): Promise<{ entries: Array<{ rank: number; userId: string; walletAddress: string; nodeScore: string; nodeLevel: number; nodeLevelTitle: string; nodeId: string | null }>; total: number }> {
    const cacheKey = CACHE_KEYS.leaderboardNode
    const cached = await redis.get<{ entries: unknown[]; total: number }>(cacheKey)
    if (cached && page === 1 && limit === 50) return cached as never

    const skip = (page - 1) * limit
    const [nodes, total] = await Promise.all([
      prisma.node.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { nodeScore: 'desc' },
        skip,
        take: limit,
        select: {
          nodeScore: true,
          nodeLevel: true,
          nodeLevelTitle: true,
          nodeId: true,
          nodeScoreRank: true,
          user: { select: { id: true, walletAddress: true } },
        },
      }),
      prisma.node.count({ where: { status: 'ACTIVE' } }),
    ])

    const entries = nodes.map((n, i) => ({
      rank: skip + i + 1,
      userId: n.user.id,
      walletAddress: n.user.walletAddress,
      nodeScore: n.nodeScore.toString(),
      nodeLevel: n.nodeLevel,
      nodeLevelTitle: n.nodeLevelTitle,
      nodeId: n.nodeId,
    }))

    if (page === 1 && limit === 50) {
      await redis.set(cacheKey, { entries, total }, config.cache.leaderboardTTL)
    }
    return { entries, total }
  }

  async getCreatorLeaderboard(limit = 50): Promise<{ entries: CreatorLeaderboardEntry[]; total: number }> {
    const cacheKey = CACHE_KEYS.leaderboardCreator
    const cached = await redis.get<{ entries: CreatorLeaderboardEntry[]; total: number }>(cacheKey)
    if (cached) return cached

    const [nodes, total] = await Promise.all([
      prisma.node.findMany({
        where: {
          creatorScore: { gt: 0 },
          user: { creatorProfile: { status: 'APPROVED' } },
        },
        orderBy: { creatorScore: 'desc' },
        take: limit,
        select: {
          creatorScore: true,
          user: {
            select: {
              id: true,
              walletAddress: true,
              creatorProfile: {
                select: {
                  twitterUsername: true,
                  _count: { select: { submissions: { where: { status: 'APPROVED' } } } },
                },
              },
            },
          },
        },
      }),
      prisma.node.count({
        where: {
          creatorScore: { gt: 0 },
          user: { creatorProfile: { status: 'APPROVED' } },
        },
      }),
    ])

    const totalScore = nodes.reduce((sum, n) => sum + n.creatorScore, BigInt(0))

    const entries: CreatorLeaderboardEntry[] = nodes.map((n, i) => {
      const score = n.creatorScore
      const sharePct =
        totalScore > BigInt(0)
          ? Number((score * BigInt(10000)) / totalScore) / 100
          : 0
      return {
        rank: i + 1,
        userId: n.user.id,
        walletAddress: n.user.walletAddress,
        twitterUsername: n.user.creatorProfile?.twitterUsername ?? null,
        creatorScore: score.toString(),
        sharePct,
        submissionCount: n.user.creatorProfile?._count.submissions ?? 0,
      }
    })

    if (entries.length > 0) {
      await redis.set(cacheKey, { entries, total }, config.cache.leaderboardTTL)
    }
    return { entries, total }
  }

  async getUserRank(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalPoints: true,
        weeklyPoints: true,
        referralPoints: true,
        globalRank: true,
        weeklyRank: true,
        referralRank: true,
      },
    })
    return user
  }

  async recalculateRanks(): Promise<void> {
    // Recalculate global ranks
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { totalPoints: 'desc' },
      select: { id: true },
    })

    await Promise.all(
      users.map((u, i) =>
        prisma.user.update({ where: { id: u.id }, data: { globalRank: i + 1 } }),
      ),
    )

    // Clear all leaderboard caches
    await Promise.all([
      redis.del(CACHE_KEYS.leaderboardGlobal),
      redis.del(CACHE_KEYS.leaderboardWeekly),
      redis.del(CACHE_KEYS.leaderboardReferral),
      redis.del(CACHE_KEYS.leaderboardNode),
    ])
  }

  async resetWeeklyPoints(): Promise<void> {
    await prisma.user.updateMany({ data: { weeklyPoints: 0 } })
    await redis.del(CACHE_KEYS.leaderboardWeekly)
  }
}

export const rankingsService = new RankingsService()
