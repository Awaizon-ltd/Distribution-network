import jwt, { type SignOptions } from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { config } from '../config'
import { UserRole } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  wallet: string
  role: UserRole
}

export interface RefreshTokenPayload {
  sub: string
  deviceId: string
  jti: string
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as SignOptions['expiresIn'],
    issuer: 'testnet-api',
    audience: 'testnet-app',
  })
}

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
    issuer: 'testnet-api',
    audience: 'testnet-app',
  })
}

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: 'testnet-api',
    audience: 'testnet-app',
  }) as AccessTokenPayload
}

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: 'testnet-api',
    audience: 'testnet-app',
  }) as RefreshTokenPayload
}

export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}

export const generateDeviceId = (): string => {
  return randomBytes(32).toString('hex')
}
