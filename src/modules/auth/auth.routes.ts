import { Router } from 'express'
import { z } from 'zod'
import { authController } from './auth.controller'
import { authRateLimit } from '../../middleware/rateLimit.middleware'
import { validateBody } from '../../middleware/validate.middleware'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

const nonceSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
})

const verifySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().startsWith('0x'),
  nonce: z.string().length(64),
  referralCode: z.string().optional(),
})

/**
 * @openapi
 * /auth/nonce:
 *   post:
 *     summary: Request a sign-in nonce
 *     tags: [Auth]
 */
router.post('/nonce', authRateLimit, validateBody(nonceSchema), authController.getNonce.bind(authController))

/**
 * @openapi
 * /auth/verify:
 *   post:
 *     summary: Verify wallet signature and authenticate
 *     tags: [Auth]
 */
router.post('/verify', authRateLimit, validateBody(verifySchema), authController.verify.bind(authController))

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post('/refresh', authController.refresh.bind(authController))

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Auth]
 */
router.post('/logout', authController.logout.bind(authController))

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     summary: Revoke all sessions
 *     tags: [Auth]
 */
router.post('/logout-all', authenticate, authController.logoutAll.bind(authController))

export default router
