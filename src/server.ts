import app from './app'
import { config } from './config'
import { connectDatabase, disconnectDatabase } from './database/client'
import { redis } from './cache/redis'
import { logger } from './utils/logger'
import { achievementsService } from './modules/achievements/achievements.service'

async function bootstrap(): Promise<void> {
  await connectDatabase()
  await redis.connect()
  await achievementsService.seedAchievements()

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.env}]`)
    logger.info(`API: http://localhost:${config.port}/api/${config.apiVersion}`)
    if (config.isDev) {
      logger.info(`Docs: http://localhost:${config.port}/api-docs`)
    }
  })

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`)
    server.close(async () => {
      await disconnectDatabase()
      await redis.disconnect()
      logger.info('Server closed')
      process.exit(0)
    })

    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    const err = reason as NodeJS.ErrnoException | null
    if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED') return
    logger.error('Unhandled Promise Rejection:', reason)
  })

  process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') return
    logger.error('Uncaught Exception:', error)
    process.exit(1)
  })
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err)
  process.exit(1)
})
