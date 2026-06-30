import { Router } from 'express'
import { z } from 'zod'
import { adminController } from './admin.controller'
import { adminCreatorController } from './admin.creator.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'
import { validateBody } from '../../middleware/validate.middleware'

const router = Router()
router.use(authenticate, requireAdmin)

const adjustPointsSchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, 'Amount cannot be 0'),
  reason: z.string().min(5).max(200),
})

const rejectReasonSchema = z.object({
  reason: z.string().min(5).max(300),
})

const rejectSubmissionSchema = z.object({
  reason: z.string().min(5).max(300),
  penaltyApplied: z.boolean().optional(),
})

const bulkApproveSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
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

// Creator Program
router.get('/creator/stats', adminCreatorController.getStats.bind(adminCreatorController))
router.get('/creator/applications', adminCreatorController.listApplications.bind(adminCreatorController))
router.post('/creator/applications/:id/approve', adminCreatorController.approveApplication.bind(adminCreatorController))
router.post('/creator/applications/:id/reject', validateBody(rejectReasonSchema), adminCreatorController.rejectApplication.bind(adminCreatorController))
router.get('/creator/submissions', adminCreatorController.listSubmissions.bind(adminCreatorController))
router.get('/creator/submissions/:id', adminCreatorController.getSubmission.bind(adminCreatorController))
router.post('/creator/submissions/:id/approve', adminCreatorController.approveSubmission.bind(adminCreatorController))
router.post('/creator/submissions/:id/reject', validateBody(rejectSubmissionSchema), adminCreatorController.rejectSubmission.bind(adminCreatorController))
router.post('/creator/submissions/bulk-approve', validateBody(bulkApproveSchema), adminCreatorController.bulkApprove.bind(adminCreatorController))

export default router
