import { Router } from 'express'
import { notificationsController } from './notifications.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', notificationsController.getAll.bind(notificationsController))
router.get('/unread-count', notificationsController.getUnreadCount.bind(notificationsController))
router.post('/read-all', notificationsController.markAllRead.bind(notificationsController))
router.post('/:id/read', notificationsController.markRead.bind(notificationsController))

export default router
