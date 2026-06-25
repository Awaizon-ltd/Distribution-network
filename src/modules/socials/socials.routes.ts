import { Router } from 'express'
import { z } from 'zod'
import { socialsController } from './socials.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validateBody } from '../../middleware/validate.middleware'
import { strictRateLimit } from '../../middleware/rateLimit.middleware'

const router = Router()
router.use(authenticate)

const platformSchema = z.object({
  platform: z.enum(['TWITTER', 'TELEGRAM', 'DISCORD']),
})

const connectSchema = platformSchema.extend({
  username: z.string().min(1).max(100),
})

const verifySchema = platformSchema.extend({
  code: z.string().length(32),
})

router.get('/', socialsController.getConnections.bind(socialsController))
router.post('/connect', strictRateLimit, validateBody(connectSchema), socialsController.initConnect.bind(socialsController))
router.post('/verify', strictRateLimit, validateBody(verifySchema), socialsController.verify.bind(socialsController))
router.post('/disconnect', validateBody(platformSchema), socialsController.disconnect.bind(socialsController))

export default router
