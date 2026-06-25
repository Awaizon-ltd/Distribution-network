import rateLimit from 'express-rate-limit'
import { config } from '../config'
import { TooManyRequestsError } from '../utils/errors'

export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests, please try again later'))
  },
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts'))
  },
})

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Rate limit exceeded'))
  },
})
