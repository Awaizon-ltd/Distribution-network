import { Request, Response, NextFunction } from 'express'
import { socialsService } from './socials.service'
import { sendSuccess } from '../../utils/response'
import { SocialPlatform } from '@prisma/client'

class SocialsController {
  async getConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const connections = await socialsService.getSocialConnections(req.user!.id)
      sendSuccess(res, connections)
    } catch (error) {
      next(error)
    }
  }

  async initConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform, username } = req.body
      const result = await socialsService.initConnect(req.user!.id, platform as SocialPlatform, username)
      sendSuccess(res, result, 'Verification initiated')
    } catch (error) {
      next(error)
    }
  }

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform, code } = req.body
      await socialsService.verifySocial(req.user!.id, platform as SocialPlatform, code)
      sendSuccess(res, null, 'Social account verified')
    } catch (error) {
      next(error)
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = req.body
      await socialsService.disconnect(req.user!.id, platform as SocialPlatform)
      sendSuccess(res, null, 'Social account disconnected')
    } catch (error) {
      next(error)
    }
  }
}

export const socialsController = new SocialsController()
