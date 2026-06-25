import { Worker, Job } from 'bullmq'
import { bullConnectionOptions } from '../../config/bull-connection'
import { notificationsService } from '../../modules/notifications/notifications.service'
import { logger } from '../../utils/logger'
import { NotificationType } from '@prisma/client'

export const notificationWorker = new Worker(
  'notification-delivery',
  async (job: Job) => {
    const { userId, type, title, message, data } = job.data
    await notificationsService.create(userId, type as NotificationType, title, message, data)
    logger.debug(`Notification delivered to user ${userId}: ${title}`)
  },
  { connection: bullConnectionOptions, concurrency: 10 },
)

notificationWorker.on('failed', (job, err) => {
  logger.error(`Notification job failed: ${job?.id}`, err)
})
