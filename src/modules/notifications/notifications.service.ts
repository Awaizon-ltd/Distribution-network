import { prisma } from '../../database/client'
import { NotificationType } from '@prisma/client'

class NotificationsService {
  async getNotifications(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
    ])
    return { notifications, total, unreadCount }
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: object,
  ): Promise<void> {
    await prisma.notification.create({
      data: { userId, type, title, message, data: data as never },
    })
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } })
  }
}

export const notificationsService = new NotificationsService()
