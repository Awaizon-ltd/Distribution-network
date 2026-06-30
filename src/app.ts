import 'express-async-errors'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { config } from './config'
import { logger } from './utils/logger'
import { globalRateLimit } from './middleware/rateLimit.middleware'
import { errorHandler, notFound } from './middleware/error.middleware'

// Route imports
import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import nodesRoutes from './modules/nodes/nodes.routes'
import missionsRoutes from './modules/missions/missions.routes'
import referralsRoutes from './modules/referrals/referrals.routes'
import rankingsRoutes from './modules/rankings/rankings.routes'
import socialsRoutes from './modules/socials/socials.routes'
import newsRoutes from './modules/news/news.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'
import adminRoutes from './modules/admin/admin.routes'
import achievementsRoutes from './modules/achievements/achievements.routes'
import creatorRoutes from './modules/creator/creator.routes'

const app = express()

// Serialize BigInt as number so res.json() never throws on Prisma BigInt fields
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value,
)

// ─── Security ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: config.isProd ? undefined : false,
}))
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.origins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID'],
}))

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(compression())
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))
app.use(cookieParser())

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(config.isDev ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}))

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(globalRateLimit)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// ─── Swagger ──────────────────────────────────────────────────────────────────
if (config.isDev) {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'Testnet API', version: '1.0.0', description: 'Web3 Farming Platform API' },
      servers: [{ url: `/api/${config.apiVersion}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ['./src/modules/**/*.routes.ts'],
  })
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}

// ─── API Routes ──────────────────────────────────────────────────────────────
const apiPrefix = `/api/${config.apiVersion}`

app.use(`${apiPrefix}/auth`, authRoutes)
app.use(`${apiPrefix}/users`, usersRoutes)
app.use(`${apiPrefix}/nodes`, nodesRoutes)
app.use(`${apiPrefix}/missions`, missionsRoutes)
app.use(`${apiPrefix}/referrals`, referralsRoutes)
app.use(`${apiPrefix}/rankings`, rankingsRoutes)
app.use(`${apiPrefix}/socials`, socialsRoutes)
app.use(`${apiPrefix}/news`, newsRoutes)
app.use(`${apiPrefix}/notifications`, notificationsRoutes)
app.use(`${apiPrefix}/admin`, adminRoutes)
app.use(`${apiPrefix}/achievements`, achievementsRoutes)
app.use(`${apiPrefix}/creator`, creatorRoutes)

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

export default app
