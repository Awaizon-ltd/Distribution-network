import { Router } from 'express'
import { rankingsController } from './rankings.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.get('/global', rankingsController.getGlobal.bind(rankingsController))
router.get('/weekly', rankingsController.getWeekly.bind(rankingsController))
router.get('/referral', rankingsController.getReferral.bind(rankingsController))
router.get('/node-score', rankingsController.getNodeScore.bind(rankingsController))
router.get('/creator', rankingsController.getCreator.bind(rankingsController))
router.get('/me', authenticate, rankingsController.getMyRank.bind(rankingsController))

export default router
