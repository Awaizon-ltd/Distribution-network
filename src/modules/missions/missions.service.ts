import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors'
import { nodesService } from '../nodes/nodes.service'
import { SCORE_VALUES } from '../nodes/node.levels'

const MISSION_SCORE_SOURCE: Record<string, keyof typeof SCORE_VALUES> = {
  DAILY: 'MISSION_DAILY',
  WEEKLY: 'MISSION_WEEKLY',
  SPECIAL: 'MISSION_SPECIAL',
  COMMUNITY: 'MISSION_COMMUNITY',
  REFERRAL: 'MISSION_REFERRAL',
  SOCIAL: 'MISSION_SOCIAL',
}

class MissionsService {
  async getActiveMissions(userId: string) {
    const cacheKey = `missions:user:${userId}`
    const cached = await redis.get(cacheKey)
    if (cached) return cached

    const [missions, completions] = await Promise.all([
      prisma.mission.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { endsAt: null },
            { endsAt: { gt: new Date() } },
          ],
        },
        orderBy: [{ type: 'asc' }, { points: 'desc' }],
      }),
      prisma.missionCompletion.findMany({
        where: { userId },
        select: { missionId: true, status: true, progress: true, completedAt: true, claimedAt: true, pointsEarned: true },
      }),
    ])

    const completionMap = new Map(completions.map((c) => [c.missionId, c]))
    const result = missions.map((m) => ({
      ...m,
      points: Number(m.points),
      completion: completionMap.get(m.id) ?? null,
    }))

    await redis.set(cacheKey, result, config.cache.missionsTTL)
    return result
  }

  async startMission(userId: string, missionId: string): Promise<void> {
    const mission = await prisma.mission.findFirst({
      where: {
        id: missionId,
        status: 'ACTIVE',
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    })
    if (!mission) throw new NotFoundError('Mission not found or expired')

    const existing = await prisma.missionCompletion.findUnique({
      where: { userId_missionId: { userId, missionId } },
    })
    if (existing) throw new ConflictError('Mission already started or completed')

    await prisma.missionCompletion.create({
      data: { userId, missionId, status: 'STARTED', progress: 0 },
    })

    await redis.del(`missions:user:${userId}`)
  }

  async completeMission(userId: string, missionId: string): Promise<void> {
    const completion = await prisma.missionCompletion.findUnique({
      where: { userId_missionId: { userId, missionId } },
      include: { mission: true },
    })
    if (!completion) throw new NotFoundError('Mission not started')
    if (completion.status === 'COMPLETED' || completion.status === 'CLAIMED') {
      throw new BadRequestError('Mission already completed')
    }

    await prisma.missionCompletion.update({
      where: { userId_missionId: { userId, missionId } },
      data: {
        status: 'COMPLETED',
        progress: completion.mission.requiredCount,
        completedAt: new Date(),
        pointsEarned: completion.mission.points + completion.mission.bonusPoints,
      },
    })

    await redis.del(`missions:user:${userId}`)
  }

  async claimMission(userId: string, missionId: string): Promise<void> {
    const completion = await prisma.missionCompletion.findUnique({
      where: { userId_missionId: { userId, missionId } },
      include: { mission: true },
    })
    if (!completion) throw new NotFoundError('Mission not started')
    if (completion.status !== 'COMPLETED') throw new BadRequestError('Mission not completed yet')

    await prisma.missionCompletion.update({
      where: { userId_missionId: { userId, missionId } },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    })

    const missionType = completion.mission.type as string
    const scoreKey = MISSION_SCORE_SOURCE[missionType] ?? 'MISSION_DAILY'
    const scoreAmount = (completion.mission as never as { nodeScoreReward?: number }).nodeScoreReward
      ?? SCORE_VALUES[scoreKey]

    await nodesService.addScore(
      userId,
      scoreAmount,
      `MISSION_${missionType}` as never,
      `Completed mission: ${completion.mission.title}`,
      missionId,
    )

    await redis.del(`missions:user:${userId}`)
  }

  async getMissionTypes() {
    return ['DAILY', 'WEEKLY', 'SOCIAL', 'COMMUNITY', 'REFERRAL', 'SPECIAL']
  }

  async createMission(data: {
    title: string
    description: string
    type: string
    points: number
    bonusPoints?: number
    requiredCount?: number
    imageUrl?: string
    startsAt?: Date
    endsAt?: Date
  }) {
    return prisma.mission.create({ data: data as never })
  }

  async updateMission(id: string, data: Partial<{
    title: string
    description: string
    status: string
    points: number
    endsAt: Date
  }>) {
    const mission = await prisma.mission.update({ where: { id }, data: data as never })
    await redis.del(CACHE_KEYS.missionsActive)
    await redis.invalidatePattern('missions:user:*')
    return mission
  }
}

export const missionsService = new MissionsService()
