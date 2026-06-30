import Redis from 'ioredis'
import { config } from '../config'
import { logger } from '../utils/logger'

class RedisClient {
  private client: Redis
  private static instance: RedisClient

  private constructor() {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null
        return Math.min(times * 200, 5000)
      },
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      enableReadyCheck: true,
    })

    this.client.on('connect', () => logger.info('Redis connected'))
    this.client.on('ready', () => logger.info('Redis ready'))
    this.client.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        logger.warn(`Redis connection dropped (${err.code}), reconnecting…`)
      } else {
        logger.error('Redis error:', err)
      }
    })
    this.client.on('reconnecting', () => logger.warn('Redis reconnecting'))
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient()
    }
    return RedisClient.instance
  }

  get raw(): Redis {
    return this.client
  }

  async connect(): Promise<void> {
    if (['ready', 'connect', 'connecting'].includes(this.client.status)) return
    await this.client.connect()
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized)
    } else {
      await this.client.set(key, serialized)
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern)
    if (keys.length > 0) await this.client.del(...keys)
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key)
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl)
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key)
    return result === 1
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member)
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return this.client.zrange(key, start, stop, 'WITHSCORES')
    }
    return this.client.zrange(key, start, stop)
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return this.client.zrevrange(key, start, stop, 'WITHSCORES')
    }
    return this.client.zrevrange(key, start, stop)
  }

  async zrank(key: string, member: string): Promise<number | null> {
    return this.client.zrank(key, member)
  }

  async zscore(key: string, member: string): Promise<string | null> {
    return this.client.zscore(key, member)
  }

  async disconnect(): Promise<void> {
    await this.client.quit()
    logger.info('Redis disconnected')
  }
}

export const redis = RedisClient.getInstance()

// Cache key constants
export const CACHE_KEYS = {
  user: (wallet: string) => `user:${wallet.toLowerCase()}`,
  userById: (id: string) => `user:id:${id}`,
  // Separate key for auth middleware so it never collides with the full profile cache
  authUser: (id: string) => `auth:user:${id}`,
  missionsActive: 'missions:active',
  missionsDailyByUser: (userId: string) => `missions:daily:${userId}`,
  leaderboardGlobal: 'leaderboard:global',
  leaderboardWeekly: 'leaderboard:weekly',
  leaderboardReferral: 'leaderboard:referral',
  leaderboardNode: 'leaderboard:nodescore',
  newsLatest: 'news:latest',
  newsById: (id: string) => `news:${id}`,
  nodeByUser: (userId: string) => `node:${userId}`,
  socialsByUser: (userId: string) => `socials:${userId}`,
  referralsByUser: (userId: string) => `referrals:${userId}`,
  nonce: (wallet: string) => `nonce:${wallet.toLowerCase()}`,
  rateLimitAuth: (ip: string) => `rl:auth:${ip}`,
} as const
