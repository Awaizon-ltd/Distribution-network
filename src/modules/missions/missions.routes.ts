import { Router } from 'express'
import { missionsController } from './missions.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { strictRateLimit } from '../../middleware/rateLimit.middleware'

const router = Router()

router.use(authenticate)

router.get('/', missionsController.getActiveMissions.bind(missionsController))
router.post('/:id/go', strictRateLimit, missionsController.go.bind(missionsController))
router.post('/:id/start', strictRateLimit, missionsController.start.bind(missionsController))
router.post('/:id/complete', strictRateLimit, missionsController.complete.bind(missionsController))
router.post('/:id/claim', strictRateLimit, missionsController.claim.bind(missionsController))

export default router
