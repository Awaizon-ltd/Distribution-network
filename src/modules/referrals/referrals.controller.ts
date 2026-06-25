import { Request, Response, NextFunction } from 'express'
import { referralsService } from './referrals.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class ReferralsController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await referralsService.getReferralStats(req.user!.id)
      sendSuccess(res, stats)
    } catch (error) {
      next(error)
    }
  }

  async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
      const { referrals, total } = await referralsService.getReferrals(req.user!.id, page, limit)
      sendPaginated(res, referrals, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async validateCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await referralsService.validateReferralCode(req.params.code as string)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }
}

export const referralsController = new ReferralsController()
