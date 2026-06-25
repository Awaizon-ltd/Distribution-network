import { Router } from 'express'
import { achievementsController } from './achievements.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.get('/', achievementsController.getAll.bind(achievementsController))
router.get('/me', authenticate, achievementsController.getMyAchievements.bind(achievementsController))

export default router
