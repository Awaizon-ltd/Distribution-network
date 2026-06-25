import { Request, Response, NextFunction } from 'express'
import { notificationsService } from './notifications.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

class NotificationsController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 50)
      const { notifications, total, unreadCount } = await notificationsService.getNotifications(req.user!.id, page, limit)
      res.json({ success: true, data: notifications, meta: { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount } })
    } catch (error) {
      next(error)
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationsService.markRead(req.user!.id, req.params.id as string)
      sendSuccess(res, null, 'Marked as read')
    } catch (error) {
      next(error)
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationsService.markAllRead(req.user!.id)
      sendSuccess(res, null, 'All notifications marked as read')
    } catch (error) {
      next(error)
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationsService.getUnreadCount(req.user!.id)
      sendSuccess(res, { count })
    } catch (error) {
      next(error)
    }
  }
}

export const notificationsController = new NotificationsController()
