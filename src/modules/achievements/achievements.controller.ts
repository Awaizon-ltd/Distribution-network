import { Request, Response, NextFunction } from 'express'
import { achievementsService } from './achievements.service'
import { sendSuccess } from '../../utils/response'

class AchievementsController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const achievements = await achievementsService.getAchievements()
      sendSuccess(res, achievements)
    } catch (error) {
      next(error)
    }
  }

  async getMyAchievements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const achievements = await achievementsService.getUserAchievements(req.user!.id)
      sendSuccess(res, achievements)
    } catch (error) {
      next(error)
    }
  }
}

export const achievementsController = new AchievementsController()
