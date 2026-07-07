import { Worker, Job } from 'bullmq'
import { bullConnectionOptions } from '../../config/bull-connection'
import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { logger } from '../../utils/logger'

const REFERRAL_POINTS = 100

async function sweepStuckReferrals(): Promise<{ processed: number; skipped: number }> {
  // Find all unrewarded referrals
  const unrewarded = await prisma.referral.findMany({
    where: { rewardIssued: false },
    select: { id: true, referrerId: true, refereeId: true,
      referee: { select: { walletAddress: true } },
      referrer: { select: { walletAddress: true } },
    },
  })

  if (unrewarded.length === 0) return { processed: 0, skipped: 0 }

  // Find which referees have active nodes
  const activeNodeUserIds = new Set<string>(
    (await prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM nodes WHERE status = 'ACTIVE'
    `).map(r => r.userId)
  )

  const eligible = unrewarded.filter(r => activeNodeUserIds.has(r.refereeId))

  if (eligible.length === 0) return { processed: 0, skipped: unrewarded.length }

  let processed = 0
  for (const ref of eligible) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.referral.update({
          where: { id: ref.id },
          data: { rewardIssued: true, rewardedAt: new Date(), pointsEarned: REFERRAL_POINTS },
        })
        await tx.user.update({
          where: { id: ref.referrerId },
          data: {
            totalPoints:    { increment: REFERRAL_POINTS },
            referralPoints: { increment: REFERRAL_POINTS },
          },
        })
        await tx.pointTransaction.create({
          data: {
            userId:      ref.referrerId,
            amount:      REFERRAL_POINTS,
            type:        'POINTS',
            description: `Referral reward: ${ref.referee.walletAddress.slice(0, 10)}...`,
            source:      'REFERRAL',
            sourceId:    ref.id,
          },
        })
      })

      await redis.del(CACHE_KEYS.userById(ref.referrerId))
      processed++

      logger.info(`Referral sweep: rewarded ${ref.referrer.walletAddress.slice(0, 10)} for referring ${ref.referee.walletAddress.slice(0, 10)}`)
    } catch (err: any) {
      logger.error(`Referral sweep: failed to reward referral ${ref.id}: ${err.message}`)
    }
  }

  return { processed, skipped: unrewarded.length - eligible.length }
}

export const referralSweepWorker = new Worker(
  'referral-sweep',
  async (_job: Job) => {
    const { processed, skipped } = await sweepStuckReferrals()
    if (processed > 0) {
      logger.info(`Referral sweep complete: ${processed} rewarded, ${skipped} waiting on node activation`)
    }
  },
  { connection: bullConnectionOptions, concurrency: 1 },
)

referralSweepWorker.on('failed', (_job, err) => {
  logger.error('Referral sweep job failed:', err)
})
