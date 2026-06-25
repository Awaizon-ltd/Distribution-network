import { PrismaClient } from '@prisma/client'
import { config } from '../config'
import { logger } from '../utils/logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
  })

if (config.isDev) {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      logger.warn(`Slow query (${e.duration}ms): ${e.query}`)
    }
  })
}

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error('Prisma error:', e.message)
})

if (config.isDev) globalForPrisma.prisma = prisma

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect()
    logger.info('Database connected successfully')
  } catch (error) {
    logger.error('Failed to connect to database:', error)
    throw error
  }
}

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect()
  logger.info('Database disconnected')
}
