import { Worker, Job } from 'bullmq'
import { bullConnectionOptions } from '../../config/bull-connection'
import { referralsService } from '../../modules/referrals/referrals.service'
import { addNotificationJob } from '../../queue'
import { logger } from '../../utils/logger'
import { prisma } from '../../database/client'

export const referralWorker = new Worker(
  'referral-processing',
  async (job: Job) => {
    const { referralId } = job.data as { referralId: string }
    logger.info(`Processing referral: ${referralId}`)

    try {
      await referralsService.processReferralReward(referralId)

      const referral = await prisma.referral.findUnique({
        where: { id: referralId },
        include: { referrer: true, referee: true },
      })

      if (referral) {
        await addNotificationJob({
          userId: referral.referrerId,
          type: 'REFERRAL_REWARD',
          title: 'Referral Reward Earned!',
          message: `Your referral ${referral.referee.walletAddress.slice(0, 10)}... activated their node. You earned 500 points!`,
          data: { referralId },
        })
      }

      logger.info(`Referral ${referralId} processed successfully`)
    } catch (err) {
      logger.error(`Referral processing failed: ${referralId}`, err)
      throw err
    }
  },
  { connection: bullConnectionOptions, concurrency: 5 },
)

referralWorker.on('failed', (job, err) => {
  logger.error(`Referral job failed: ${job?.id}`, err)
})
