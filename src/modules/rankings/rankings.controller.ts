import { Request, Response, NextFunction } from 'express'
import { rankingsService } from './rankings.service'
import { sendSuccess } from '../../utils/response'

class RankingsController {
  async getGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)
      const result = await rankingsService.getGlobalLeaderboard(page, limit)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }

  async getWeekly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)
      const result = await rankingsService.getWeeklyLeaderboard(page, limit)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }

  async getReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)
      const result = await rankingsService.getReferralLeaderboard(page, limit)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }

  async getNodeScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100)
      const result = await rankingsService.getNodeScoreLeaderboard(page, limit)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }

  async getCreator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 50)
      const result = await rankingsService.getCreatorLeaderboard(limit)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  }

  async getMyRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rank = await rankingsService.getUserRank(req.user!.id)
      sendSuccess(res, rank)
    } catch (error) {
      next(error)
    }
  }
}

export const rankingsController = new RankingsController()
