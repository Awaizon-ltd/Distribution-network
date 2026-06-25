import { Request, Response, NextFunction } from 'express'
import { adminService } from './admin.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class AdminController {
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
      const search = req.query.search as string | undefined
      const { users, total } = await adminService.getUsers(page, limit, search)
      sendPaginated(res, users, total, page, limit)
    } catch (error) {
      next(error)
    }
  }

  async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.suspendUser(req.params.id as string, req.user!.id)
      sendSuccess(res, null, 'User suspended')
    } catch (error) {
      next(error)
    }
  }

  async banUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.banUser(req.params.id as string, req.user!.id)
      sendSuccess(res, null, 'User banned')
    } catch (error) {
      next(error)
    }
  }

  async reinstateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.reinstateUser(req.params.id as string, req.user!.id)
      sendSuccess(res, null, 'User reinstated')
    } catch (error) {
      next(error)
    }
  }

  async adjustPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, reason } = req.body
      await adminService.adjustPoints(req.params.id as string, amount, reason, req.user!.id)
      sendSuccess(res, null, 'Points adjusted')
    } catch (error) {
      next(error)
    }
  }

  async createMission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mission = await adminService.createMission(req.body)
      sendSuccess(res, mission, 'Mission created', 201)
    } catch (error) {
      next(error)
    }
  }

  async updateMission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mission = await adminService.updateMission(req.params.id as string, req.body)
      sendSuccess(res, mission, 'Mission updated')
    } catch (error) {
      next(error)
    }
  }

  async createNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const article = await adminService.createNews({ ...req.body, authorId: req.user!.id })
      sendSuccess(res, article, 'News created', 201)
    } catch (error) {
      next(error)
    }
  }

  async publishNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const article = await adminService.publishNews(req.params.id as string)
      sendSuccess(res, article, 'News published')
    } catch (error) {
      next(error)
    }
  }

  async updateNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const article = await adminService.updateNews(req.params.id as string, req.body)
      sendSuccess(res, article, 'News updated')
    } catch (error) {
      next(error)
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await adminService.getAnalytics()
      sendSuccess(res, analytics)
    } catch (error) {
      next(error)
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
      const { logs, total } = await adminService.getAuditLogs(page, limit)
      sendPaginated(res, logs, total, page, limit)
    } catch (error) {
      next(error)
    }
  }
}

export const adminController = new AdminController()
