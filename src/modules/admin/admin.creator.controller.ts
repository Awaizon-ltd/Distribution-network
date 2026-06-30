import { Request, Response, NextFunction } from 'express'
import { adminCreatorService } from './admin.creator.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class AdminCreatorController {
  // ─── Applications ─────────────────────────────────────────────────────────

  async listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const { applications, total } = await adminCreatorService.listApplications(status, page, limit)
      sendPaginated(res, applications, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async approveApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminCreatorService.approveApplication(req.params.id as string, req.user!.id)
      sendSuccess(res, null, 'Creator application approved')
    } catch (error) {
      next(error)
    }
  }

  async rejectApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body
      await adminCreatorService.rejectApplication(req.params.id as string, req.user!.id, reason)
      sendSuccess(res, null, 'Creator application rejected')
    } catch (error) {
      next(error)
    }
  }

  // ─── Submissions ──────────────────────────────────────────────────────────

  async listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const category = typeof req.query.category === 'string' ? req.query.category : undefined
      const { submissions, total } = await adminCreatorService.listSubmissions({ status, category }, page, limit)
      sendPaginated(res, submissions, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async getSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const submission = await adminCreatorService.getSubmission(req.params.id as string)
      sendSuccess(res, submission)
    } catch (error) {
      next(error)
    }
  }

  async approveSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminCreatorService.approveSubmission(req.params.id as string, req.user!.id)
      sendSuccess(res, null, 'Submission approved and reward issued')
    } catch (error) {
      next(error)
    }
  }

  async rejectSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason, penaltyApplied } = req.body
      await adminCreatorService.rejectSubmission(req.params.id as string, req.user!.id, reason, penaltyApplied ?? false)
      sendSuccess(res, null, 'Submission rejected')
    } catch (error) {
      next(error)
    }
  }

  async bulkApprove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids } = req.body
      const result = await adminCreatorService.bulkApproveSubmissions(ids, req.user!.id)
      sendSuccess(res, result, `Bulk approval complete: ${result.succeeded} rewarded, ${result.failed} failed`)
    } catch (error) {
      next(error)
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminCreatorService.getCreatorStats()
      sendSuccess(res, stats)
    } catch (error) {
      next(error)
    }
  }
}

export const adminCreatorController = new AdminCreatorController()
