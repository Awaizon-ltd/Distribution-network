import { Router } from 'express'
import { referralsController } from './referrals.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.get('/validate/:code', referralsController.validateCode.bind(referralsController))

router.use(authenticate)
router.get('/stats', referralsController.getStats.bind(referralsController))
router.get('/', referralsController.getReferrals.bind(referralsController))

export default router
