import { Router } from 'express'
import { z } from 'zod'
import { nodesController } from './nodes.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validateBody } from '../../middleware/validate.middleware'
import { strictRateLimit } from '../../middleware/rateLimit.middleware'

const router = Router()
router.use(authenticate)

const activateSchema = z.object({
  signature: z.string().startsWith('0x'),
})

router.get('/', nodesController.getNode.bind(nodesController))
router.get('/message', nodesController.getActivationMessage.bind(nodesController))
router.get('/history', nodesController.getScoreHistory.bind(nodesController))
router.post('/activate', strictRateLimit, validateBody(activateSchema), nodesController.activate.bind(nodesController))
router.post('/check-in', strictRateLimit, nodesController.checkIn.bind(nodesController))

export default router
