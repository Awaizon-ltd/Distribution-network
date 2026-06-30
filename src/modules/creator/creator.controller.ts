import { Request, Response, NextFunction } from 'express'
import { creatorService } from './creator.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class CreatorController {
  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twitterUsername } = req.body
      const result = await creatorService.apply(req.user!.id, twitterUsername)
      sendSuccess(res, result, 'Creator application submitted. You will be notified when reviewed.', 201)
    } catch (error) {
      next(error)
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await creatorService.getProfile(req.user!.id)
      sendSuccess(res, profile)
    } catch (error) {
      next(error)
    }
  }

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tweetUrl, category, description } = req.body
      const result = await creatorService.submit(req.user!.id, tweetUrl, category, description)
      sendSuccess(res, result, 'Submission received and pending review.', 201)
    } catch (error) {
      next(error)
    }
  }

  async getSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
      const { submissions, total } = await creatorService.getSubmissions(req.user!.id, page, limit)
      sendPaginated(res, submissions, total, page, limit)
    } catch (error) {
      next(error)
    }
  }
}

export const creatorController = new CreatorController()
