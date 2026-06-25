import { Request, Response, NextFunction } from 'express'
import { prisma } from '../database/client'
import { AuditAction } from '@prisma/client'

export const auditLog = (action: AuditAction, entity: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id ?? null,
          action,
          entity,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { path: req.path, method: req.method },
        },
      })
    } catch {
      // Non-blocking — audit failures must not disrupt requests
    }
    next()
  }
}
