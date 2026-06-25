import { Request, Response, NextFunction } from 'express'
import { nodesService } from './nodes.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class NodesController {
  async getNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await nodesService.getFullNodeProfile(req.user!.id)
      sendSuccess(res, profile)
    } catch (error) {
      next(error)
    }
  }

  async getActivationMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const message = await nodesService.getNodeActivationMessage(req.user!.walletAddress)
      sendSuccess(res, { message })
    } catch (error) {
      next(error)
    }
  }

  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { signature } = req.body
      const result = await nodesService.activateNode(req.user!.id, req.user!.walletAddress, signature)
      sendSuccess(res, result, `Node ${result.nodeId} activated successfully!`, 201)
    } catch (error) {
      next(error)
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await nodesService.dailyCheckIn(req.user!.id)
      const msg = result.leveledUp
        ? `Level up! You are now ${result.newLevel?.title}!`
        : `Daily check-in complete. +${result.pointsAwarded} points`
      sendSuccess(res, result, msg)
    } catch (error) {
      next(error)
    }
  }

  async getScoreHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
      const { history, total } = await nodesService.getNodeScoreHistory(req.user!.id, page, limit)
      sendPaginated(res, history, total, page, limit)
    } catch (error) {
      next(error)
    }
  }
}

export const nodesController = new NodesController()
