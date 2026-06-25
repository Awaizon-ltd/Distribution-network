import { Request, Response, NextFunction } from 'express'
import { newsService } from './news.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class NewsController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
      const category = req.query.category as string | undefined
      const { news, total } = await newsService.getPublishedNews(page, limit, category)
      sendPaginated(res, news, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const article = await newsService.getNewsById(req.params.id as string)
      sendSuccess(res, article)
    } catch (error) {
      next(error)
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const article = await newsService.getNewsBySlug(req.params.slug as string)
      sendSuccess(res, article)
    } catch (error) {
      next(error)
    }
  }
}

export const newsController = new NewsController()
