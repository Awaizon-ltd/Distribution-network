import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  NONCE_EXPIRY_SECONDS: z.string().default('300'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),

  REFERRAL_REWARD_POINTS: z.string().default('100'),
  NODE_ACTIVATION_POINTS: z.string().default('1000'),

  LEADERBOARD_CACHE_TTL: z.string().default('300'),
  NEWS_CACHE_TTL: z.string().default('600'),
  USER_CACHE_TTL: z.string().default('120'),
  MISSIONS_CACHE_TTL: z.string().default('300'),

  BULL_CONCURRENCY: z.string().default('5'),

  LOG_LEVEL: z.string().default('info'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data

export const config = {
  env: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  apiVersion: env.API_VERSION,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  auth: {
    nonceExpirySeconds: parseInt(env.NONCE_EXPIRY_SECONDS, 10),
  },

  cors: {
    origins: env.CORS_ORIGINS.split(',').map(o => o.trim()),
  },

  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(env.RATE_LIMIT_MAX, 10),
  },

  rewards: {
    referralPoints: parseInt(env.REFERRAL_REWARD_POINTS, 10),
    nodeActivationPoints: parseInt(env.NODE_ACTIVATION_POINTS, 10),
  },

  cache: {
    leaderboardTTL: parseInt(env.LEADERBOARD_CACHE_TTL, 10),
    newsTTL: parseInt(env.NEWS_CACHE_TTL, 10),
    userTTL: parseInt(env.USER_CACHE_TTL, 10),
    missionsTTL: parseInt(env.MISSIONS_CACHE_TTL, 10),
  },

  bull: {
    concurrency: parseInt(env.BULL_CONCURRENCY, 10),
  },

  log: {
    level: env.LOG_LEVEL,
  },

  superAdminWallet: '0x4c5ec8076341cd05609a269a496cc4f9e617c1aa',
} as const

export type Config = typeof config
