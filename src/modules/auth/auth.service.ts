import { createHash, randomBytes } from 'crypto'
import { verifyMessage } from 'viem'
import { addSeconds, isBefore } from 'date-fns'
import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateDeviceId,
} from '../../auth/jwt'
import { UnauthorizedError, BadRequestError, ConflictError } from '../../utils/errors'
import { generateReferralCode } from '../../utils/referral'
import { logger } from '../../utils/logger'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  deviceId: string
}

export interface AuthResult {
  user: {
    id: string
    walletAddress: string
    referralCode: string
    role: string
    totalPoints: string
    globalRank: number | null
  }
  tokens: AuthTokens
  isNewUser: boolean
}

class AuthService {
  async getNonce(walletAddress: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const normalizedWallet = walletAddress.toLowerCase()

    // Rate-check: max 5 nonces per IP per minute (via redis counter)
    if (ipAddress) {
      const key = CACHE_KEYS.rateLimitAuth(ipAddress)
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, 60)
      if (count > 5) throw new BadRequestError('Too many nonce requests')
    }

    // Find or create user stub
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedWallet },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedWallet,
          referralCode: await generateReferralCode(),
        },
      })
    }

    // Invalidate old nonces for this user
    await prisma.authNonce.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    })

    const nonce = randomBytes(32).toString('hex')
    const expiresAt = addSeconds(new Date(), config.auth.nonceExpirySeconds)

    await prisma.authNonce.create({
      data: {
        userId: user.id,
        nonce,
        expiresAt,
        ipAddress,
        userAgent,
      },
    })

    return nonce
  }

  async verifySignature(
    walletAddress: string,
    signature: string,
    nonce: string,
    ipAddress?: string,
    userAgent?: string,
    referralCode?: string,
  ): Promise<AuthResult> {
    const normalizedWallet = walletAddress.toLowerCase() as `0x${string}`

    // Look up nonce
    const authNonce = await prisma.authNonce.findUnique({
      where: { nonce },
      include: { user: true },
    })

    if (!authNonce) throw new UnauthorizedError('Invalid nonce')
    if (authNonce.used) throw new UnauthorizedError('Nonce already used')
    if (isBefore(authNonce.expiresAt, new Date())) throw new UnauthorizedError('Nonce expired')
    if (authNonce.user.walletAddress !== normalizedWallet) {
      throw new UnauthorizedError('Wallet address mismatch')
    }

    // Verify EIP-191 signature
    const message = this.buildSignMessage(nonce)
    const isValid = await verifyMessage({
      address: normalizedWallet,
      message,
      signature: signature as `0x${string}`,
    })

    if (!isValid) throw new UnauthorizedError('Invalid signature')

    // Mark nonce as used — prevents replay attacks
    await prisma.authNonce.update({
      where: { id: authNonce.id },
      data: { used: true },
    })

    const isNewUser = !authNonce.user.lastActivityAt
    const user = authNonce.user

    // Handle referral on first sign-in
    if (isNewUser && referralCode) {
      await this.processReferral(user.id, normalizedWallet, referralCode)
    }

    // Update last activity
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActivityAt: new Date() },
    })

    // Issue tokens
    const tokens = await this.issueTokens(user.id, user.walletAddress, user.role, ipAddress, userAgent)

    // Cache user
    await redis.del(CACHE_KEYS.userById(user.id))

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        referralCode: user.referralCode,
        role: user.role,
        totalPoints: user.totalPoints.toString(),
        globalRank: user.globalRank,
      },
      tokens,
      isNewUser,
    }
  }

  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    let payload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      throw new UnauthorizedError('Invalid refresh token')
    }

    const tokenHash = hashToken(refreshToken)
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!stored || stored.revokedAt) throw new UnauthorizedError('Refresh token revoked')
    if (isBefore(stored.expiresAt, new Date())) throw new UnauthorizedError('Refresh token expired')

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    return this.issueTokens(stored.user.id, stored.user.walletAddress, stored.user.role, ipAddress, userAgent, payload.deviceId)
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken)
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await redis.del(CACHE_KEYS.userById(userId))
  }

  private async issueTokens(
    userId: string,
    walletAddress: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
    existingDeviceId?: string,
  ): Promise<AuthTokens> {
    const deviceId = existingDeviceId ?? generateDeviceId()
    const jti = randomBytes(16).toString('hex')

    const accessToken = signAccessToken({ sub: userId, wallet: walletAddress, role: role as never })
    const refreshToken = signRefreshToken({ sub: userId, deviceId, jti })
    const tokenHash = hashToken(refreshToken)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    })

    return { accessToken, refreshToken, deviceId }
  }

  private async processReferral(userId: string, walletAddress: string, code: string): Promise<void> {
    try {
      const referrer = await prisma.user.findUnique({ where: { referralCode: code } })
      if (!referrer) return
      if (referrer.walletAddress === walletAddress) return // Self-referral prevention

      const existing = await prisma.referral.findUnique({ where: { refereeId: userId } })
      if (existing) return

      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: userId,
          code,
        },
      })
    } catch (err) {
      logger.warn('Referral processing error:', err)
    }
  }

  buildSignMessage(nonce: string): string {
    return `Welcome to Testnet!\n\nSign this message to authenticate.\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any fees.`
  }
}

export const authService = new AuthService()
