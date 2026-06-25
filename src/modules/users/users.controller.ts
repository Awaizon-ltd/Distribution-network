import { Request, Response, NextFunction } from 'express'
import { usersService } from './users.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class UsersController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await usersService.getProfile(req.user!.id)
      sendSuccess(res, profile)
    } catch (error) {
      next(error)
    }
  }

  async getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await usersService.getStats(req.user!.id)
      sendSuccess(res, stats)
    } catch (error) {
      next(error)
    }
  }

  async getMyActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
      const { transactions, total } = await usersService.getActivity(req.user!.id, page, limit)
      sendPaginated(res, transactions, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async getByWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await usersService.getProfileByWallet(req.params.wallet as string)
      sendSuccess(res, profile)
    } catch (error) {
      next(error)
    }
  }
}

export const usersController = new UsersController()
