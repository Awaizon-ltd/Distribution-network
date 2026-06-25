import { Router } from 'express'
import { z } from 'zod'
import { adminController } from './admin.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'
import { validateBody } from '../../middleware/validate.middleware'

const router = Router()
router.use(authenticate, requireAdmin)

const adjustPointsSchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, 'Amount cannot be 0'),
  reason: z.string().min(5).max(200),
})

// Users
router.get('/users', adminController.getUsers.bind(adminController))
router.post('/users/:id/suspend', adminController.suspendUser.bind(adminController))
router.post('/users/:id/ban', adminController.banUser.bind(adminController))
router.post('/users/:id/reinstate', adminController.reinstateUser.bind(adminController))
router.post('/users/:id/points', validateBody(adjustPointsSchema), adminController.adjustPoints.bind(adminController))

// Missions
router.post('/missions', adminController.createMission.bind(adminController))
router.put('/missions/:id', adminController.updateMission.bind(adminController))

// News
router.post('/news', adminController.createNews.bind(adminController))
router.post('/news/:id/publish', adminController.publishNews.bind(adminController))
router.put('/news/:id', adminController.updateNews.bind(adminController))

// Analytics
router.get('/analytics', adminController.getAnalytics.bind(adminController))
router.get('/audit-logs', adminController.getAuditLogs.bind(adminController))

export default router
