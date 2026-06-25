import { Worker, Job } from 'bullmq'
import { bullConnectionOptions } from '../../config/bull-connection'
import { rankingsService } from '../../modules/rankings/rankings.service'
import { logger } from '../../utils/logger'

export const weeklyResetWorker = new Worker(
  'weekly-reset',
  async (_job: Job) => {
    logger.info('Starting weekly points reset...')
    await rankingsService.resetWeeklyPoints()
    logger.info('Weekly points reset complete')
  },
  { connection: bullConnectionOptions, concurrency: 1 },
)

weeklyResetWorker.on('failed', (job, err) => {
  logger.error(`Weekly reset job failed: ${job?.id}`, err)
})
