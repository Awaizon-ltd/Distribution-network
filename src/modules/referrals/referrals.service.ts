import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { pointsService } from '../points/points.service'
import { nodesService } from '../nodes/nodes.service'
import { SCORE_VALUES, REFERRAL_MILESTONES } from '../nodes/node.levels'
import { achievementsService } from '../achievements/achievements.service'

class ReferralsService {
  async getReferrals(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referee: {
            select: {
              walletAddress: true,
              createdAt: true,
              node: { select: { status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.referral.count({ where: { referrerId: userId } }),
    ])

    return { referrals, total }
  }

  async getReferralStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referralPoints: true, referralRank: true },
    })
    if (!user) throw new NotFoundError('User not found')

    const [total, rewarded] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({ where: { referrerId: userId, rewardIssued: true } }),
    ])

    const baseUrl = process.env.FRONTEND_URL ?? 'https://testnet.awarizon.com'
    return {
      code: user.referralCode,
      url: `${baseUrl}?ref=${user.referralCode}`,
      totalReferrals: total,
      rewardedReferrals: rewarded,
      pendingReferrals: total - rewarded,
      totalPoints: user.referralPoints.toString(),
      rank: user.referralRank,
    }
  }

  async processReferralReward(referralId: string): Promise<void> {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referee: { include: { node: true } },
        referrer: true,
      },
    })

    if (!referral) throw new NotFoundError('Referral not found')
    if (referral.rewardIssued) throw new BadRequestError('Reward already issued')

    // Node activation required
    if (!referral.referee.node || referral.referee.node.status !== 'ACTIVE') {
      throw new BadRequestError('Referee must activate node first')
    }

    const rewardPoints = config.rewards.referralPoints
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: referralId },
        data: {
          rewardIssued: true,
          rewardedAt: new Date(),
          pointsEarned: rewardPoints,
          scoreEarned: SCORE_VALUES.REFERRAL_ACTIVATION,
        },
      })
    })

    // Award points to referrer
    await pointsService.addPoints(
      referral.referrerId,
      rewardPoints,
      'REFERRAL',
      `Referral reward: ${referral.referee.walletAddress.slice(0, 10)}...`,
      referralId,
    )

    // Award node score to referrer for gaining a referral activation
    await nodesService.addScore(
      referral.referrerId,
      SCORE_VALUES.REFERRAL_ACTIVATION,
      'REFERRAL_ACTIVATION',
      `Node activated via referral: ${referral.referee.walletAddress.slice(0, 10)}...`,
      referralId,
    )

    // Check referral milestones
    const rewardedCount = await prisma.referral.count({
      where: { referrerId: referral.referrerId, rewardIssued: true },
    })
    await this.checkReferralMilestones(referral.referrerId, rewardedCount)

    await redis.del(CACHE_KEYS.referralsByUser(referral.referrerId))
  }

  private async checkReferralMilestones(userId: string, rewardedCount: number): Promise<void> {
    for (const milestone of REFERRAL_MILESTONES) {
      if (rewardedCount === milestone.count) {
        await nodesService.addScore(
          userId,
          milestone.scoreBonus,
          'REFERRAL_MILESTONE',
          `Referral milestone: ${milestone.count} referrals`,
        )
        await achievementsService.awardByKey(userId, milestone.achievementKey)
      }
    }
  }

  async validateReferralCode(code: string): Promise<{ valid: boolean; referrerWallet?: string }> {
    const user = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { walletAddress: true },
    })
    return { valid: !!user, referrerWallet: user?.walletAddress }
  }
}

export const referralsService = new ReferralsService()
