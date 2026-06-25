import { Request, Response, NextFunction } from 'express'
import { missionsService } from './missions.service'
import { sendSuccess } from '../../utils/response'

class MissionsController {
  async getActiveMissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const missions = await missionsService.getActiveMissions(req.user!.id)
      sendSuccess(res, missions)
    } catch (error) {
      next(error)
    }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await missionsService.startMission(req.user!.id, req.params.id)
      sendSuccess(res, null, 'Mission started')
    } catch (error) {
      next(error)
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await missionsService.completeMission(req.user!.id, req.params.id)
      sendSuccess(res, null, 'Mission completed')
    } catch (error) {
      next(error)
    }
  }

  async claim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await missionsService.claimMission(req.user!.id, req.params.id)
      sendSuccess(res, null, 'Rewards claimed successfully')
    } catch (error) {
      next(error)
    }
  }
}

export const missionsController = new MissionsController()
