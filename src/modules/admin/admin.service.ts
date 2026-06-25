import { prisma } from '../../database/client'
import { redis } from '../../cache/redis'
import { pointsService } from '../points/points.service'
import { missionsService } from '../missions/missions.service'
import { newsService } from '../news/news.service'
import { NotFoundError } from '../../utils/errors'

class AdminService {
  // ─── Users ────────────────────────────────────────────────────────────────

  async getUsers(page = 1, limit = 50, search?: string) {
    const where = search
      ? { walletAddress: { contains: search.toLowerCase() } }
      : {}
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, walletAddress: true, role: true, status: true,
          totalPoints: true, globalRank: true, createdAt: true, lastActivityAt: true,
          node: { select: { status: true } },
          _count: { select: { referralsMade: true, missions: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    return { users, total }
  }

  async suspendUser(userId: string, adminId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User not found')

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } }),
      prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({
        data: { userId: adminId, action: 'USER_SUSPENDED', entity: 'User', entityId: userId },
      }),
    ])

    await redis.invalidatePattern(`user:*`)
  }

  async banUser(userId: string, adminId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User not found')

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } }),
      prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({
        data: { userId: adminId, action: 'USER_BANNED', entity: 'User', entityId: userId },
      }),
    ])

    await redis.invalidatePattern(`user:*`)
  }

  async reinstateUser(userId: string, adminId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } }),
      prisma.auditLog.create({
        data: { userId: adminId, action: 'USER_UPDATED', entity: 'User', entityId: userId },
      }),
    ])
    await redis.invalidatePattern(`user:*`)
  }

  async adjustPoints(userId: string, amount: number, reason: string, adminId: string): Promise<void> {
    if (amount > 0) {
      await pointsService.addPoints(userId, amount, 'ADMIN', reason)
    } else {
      await pointsService.deductPoints(userId, Math.abs(amount), 'ADMIN', reason)
    }
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: amount > 0 ? 'POINTS_ADDED' : 'POINTS_DEDUCTED',
        entity: 'User',
        entityId: userId,
        metadata: { amount, reason },
      },
    })
  }

  // ─── Missions ─────────────────────────────────────────────────────────────

  async createMission(data: object) {
    return missionsService.createMission(data as never)
  }

  async updateMission(id: string, data: object) {
    return missionsService.updateMission(id, data as never)
  }

  async deleteMission(id: string): Promise<void> {
    await missionsService.updateMission(id, { status: 'ARCHIVED' } as never)
  }

  // ─── News ─────────────────────────────────────────────────────────────────

  async createNews(data: object) {
    return newsService.createNews(data as never)
  }

  async publishNews(id: string) {
    return newsService.publishNews(id)
  }

  async updateNews(id: string, data: object) {
    return newsService.updateNews(id, data)
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics() {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeToday,
      activeThisWeek,
      totalNodes,
      activeNodes,
      totalMissions,
      claimedMissions,
      totalReferrals,
      rewardedReferrals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActivityAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { lastActivityAt: { gte: weekAgo } } }),
      prisma.node.count(),
      prisma.node.count({ where: { status: 'ACTIVE' } }),
      prisma.mission.count({ where: { status: 'ACTIVE' } }),
      prisma.missionCompletion.count({ where: { status: 'CLAIMED' } }),
      prisma.referral.count(),
      prisma.referral.count({ where: { rewardIssued: true } }),
    ])

    return {
      users: { total: totalUsers, activeToday, activeThisWeek },
      nodes: { total: totalNodes, active: activeNodes },
      missions: { active: totalMissions, claimed: claimedMissions },
      referrals: { total: totalReferrals, rewarded: rewardedReferrals },
    }
  }

  async getAuditLogs(page = 1, limit = 50) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { walletAddress: true } } },
      }),
      prisma.auditLog.count(),
    ])
    return { logs, total }
  }
}

export const adminService = new AdminService()
