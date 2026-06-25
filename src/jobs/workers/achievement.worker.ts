import { Worker } from 'bullmq'
import { redis } from '../../cache/redis'
import { achievementsService } from '../../modules/achievements/achievements.service'
import { logger } from '../../utils/logger'

export const achievementWorker = new Worker(
  'achievement-check',
  async (job) => {
    const { userId, source, newScore, level } = job.data as {
      userId: string
      source: string
      newScore?: number
      level?: number
    }
    await achievementsService.checkAndAwardAchievements(userId, { source, newScore, level })
  },
  {
    connection: redis.raw,
    concurrency: 10,
  },
)

achievementWorker.on('failed', (job, err) => {
  logger.error(`Achievement job ${job?.id} failed:`, err)
})
