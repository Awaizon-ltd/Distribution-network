import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../database/client'
import { redis, CACHE_KEYS } from '../cache/redis'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { UserRole } from '@prisma/client'

export interface AuthenticatedUser {
  id: string
  walletAddress: string
  role: UserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

interface AccessTokenPayload {
  sub: string
  wallet: string
  role: UserRole
  iat: number
  exp: number
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)

    let payload: AccessTokenPayload
    try {
      payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload
    } catch {
      throw new UnauthorizedError('Invalid or expired access token')
    }

    // Check cached auth user — uses a separate key from the full profile cache
    // to prevent the minimal {id,walletAddress,role} object from poisoning getProfile()
    let user = await redis.get<AuthenticatedUser>(CACHE_KEYS.authUser(payload.sub))
    if (!user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, walletAddress: true, role: true, status: true },
      })

      if (!dbUser) throw new UnauthorizedError('User not found')
      if (dbUser.status === 'SUSPENDED') throw new ForbiddenError('Account suspended')
      if (dbUser.status === 'BANNED') throw new ForbiddenError('Account banned')

      user = { id: dbUser.id, walletAddress: dbUser.walletAddress, role: dbUser.role }
      await redis.set(CACHE_KEYS.authUser(payload.sub), user, config.cache.userTTL)
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError())
      return
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'))
      return
    }
    next()
  }
}

export const requireAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export const requireModerator = requireRole(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
