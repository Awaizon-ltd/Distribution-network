import { Router } from 'express'
import { usersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/me', usersController.getMe.bind(usersController))
router.get('/me/stats', usersController.getMyStats.bind(usersController))
router.get('/me/activity', usersController.getMyActivity.bind(usersController))
router.get('/wallet/:wallet', usersController.getByWallet.bind(usersController))

export default router
