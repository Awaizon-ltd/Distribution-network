import { Router } from 'express'
import { z } from 'zod'
import { creatorController } from './creator.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validateBody, validateQuery } from '../../middleware/validate.middleware'
import { strictRateLimit } from '../../middleware/rateLimit.middleware'

const router = Router()
router.use(authenticate)

const applySchema = z.object({
  twitterUsername: z.string().min(1).max(50).regex(/^@?[\w]+$/, 'Invalid Twitter username'),
})

const submitSchema = z.object({
  tweetUrl: z
    .string()
    .url()
    .regex(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/, 'Must be a valid Twitter/X status URL'),
  category: z.enum(['TWEET', 'THREAD', 'VIDEO', 'EDUCATIONAL']),
  description: z.string().max(500).optional(),
})

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

router.post('/apply', strictRateLimit, validateBody(applySchema), creatorController.apply.bind(creatorController))
router.get('/profile', creatorController.getProfile.bind(creatorController))
router.post('/submit', strictRateLimit, validateBody(submitSchema), creatorController.submit.bind(creatorController))
router.get('/submissions', validateQuery(paginationSchema), creatorController.getSubmissions.bind(creatorController))

export default router
