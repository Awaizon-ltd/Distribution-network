import 'express-async-errors'
import { connectDatabase } from '../database/client'
import { redis } from '../cache/redis'
import { logger } from '../utils/logger'

// Import all workers to register them
import './workers/referral.worker'
import './workers/ranking.worker'
import './workers/notification.worker'
import './workers/weeklyReset.worker'
import './workers/achievement.worker'

// Import queues for scheduling
import { rankingQueue, weeklyResetQueue } from '../queue'

async function startWorker(): Promise<void> {
  await connectDatabase()
  await redis.connect()

  // Schedule rank recalculation every 5 minutes
  await rankingQueue.upsertJobScheduler(
    'scheduled-rank-recalc',
    { every: 5 * 60 * 1000 },
    { name: 'recalculate-ranks', data: {} },
  )

  // Schedule weekly reset every Monday at midnight UTC
  await weeklyResetQueue.upsertJobScheduler(
    'scheduled-weekly-reset',
    { pattern: '0 0 * * 1' },
    { name: 'reset-weekly', data: {} },
  )

  logger.info('BullMQ worker started — all queues active')

  process.on('SIGTERM', async () => {
    logger.info('Worker shutting down...')
    process.exit(0)
  })
}

startWorker().catch((err) => {
  logger.error('Worker failed to start:', err)
  process.exit(1)
})
