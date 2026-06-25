import { Worker, Job } from 'bullmq'
import { bullConnectionOptions } from '../../config/bull-connection'
import { rankingsService } from '../../modules/rankings/rankings.service'
import { logger } from '../../utils/logger'

export const rankingWorker = new Worker(
  'ranking-recalculation',
  async (_job: Job) => {
    logger.info('Recalculating global ranks...')
    await rankingsService.recalculateRanks()
    logger.info('Rank recalculation complete')
  },
  { connection: bullConnectionOptions, concurrency: 1 },
)

rankingWorker.on('failed', (job, err) => {
  logger.error(`Ranking job failed: ${job?.id}`, err)
})
