import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors'
import { SocialPlatform } from '@prisma/client'
import { nodesService } from '../nodes/nodes.service'
import { SCORE_VALUES } from '../nodes/node.levels'

class SocialsService {
  async getSocialConnections(userId: string) {
    const cached = await redis.get(CACHE_KEYS.socialsByUser(userId))
    if (cached) return cached

    const connections = await prisma.socialConnection.findMany({
      where: { userId, status: { not: 'DISCONNECTED' } },
      select: {
        id: true,
        platform: true,
        username: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
      },
    })

    await redis.set(CACHE_KEYS.socialsByUser(userId), connections, 300)
    return connections
  }

  async initConnect(userId: string, platform: SocialPlatform, username: string) {
    const existing = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform } },
    })

    if (existing?.status === 'VERIFIED') {
      throw new ConflictError(`${platform} already connected`)
    }

    const connection = await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform } },
      create: { userId, platform, username, status: 'VERIFIED', verifiedAt: new Date() },
      update: { username, status: 'VERIFIED', verifiedAt: new Date(), verificationCode: null, disconnectedAt: null },
    })

    try {
      await nodesService.addScore(
        userId,
        SCORE_VALUES.SOCIAL_CONNECT,
        'SOCIAL_CONNECT',
        `Connected ${platform}`,
        connection.id,
      )
    } catch {
      // Node not active — score skipped
    }

    await redis.del(CACHE_KEYS.socialsByUser(userId))
    return { username, platform }
  }

  async verifySocial(userId: string, platform: SocialPlatform, code: string): Promise<void> {
    const connection = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform } },
    })

    if (!connection) throw new NotFoundError('Social connection not found')
    if (connection.status === 'VERIFIED') throw new BadRequestError('Already verified')
    if (connection.verificationCode !== code) throw new BadRequestError('Invalid verification code')

    await prisma.socialConnection.update({
      where: { userId_platform: { userId, platform } },
      data: { status: 'VERIFIED', verifiedAt: new Date(), verificationCode: null },
    })

    // Award score if node is active; if not, skip silently (social is still verified)
    try {
      await nodesService.addScore(
        userId,
        SCORE_VALUES.SOCIAL_CONNECT,
        'SOCIAL_CONNECT',
        `Connected ${platform}`,
        connection.id,
      )
    } catch {
      // Node not active — score will not be awarded
    }

    await redis.del(CACHE_KEYS.socialsByUser(userId))
  }

  async disconnect(userId: string, platform: SocialPlatform): Promise<void> {
    const connection = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform } },
    })

    if (!connection || connection.status === 'DISCONNECTED') {
      throw new NotFoundError('Social connection not found')
    }

    await prisma.socialConnection.update({
      where: { userId_platform: { userId, platform } },
      data: { status: 'DISCONNECTED', disconnectedAt: new Date() },
    })

    await redis.del(CACHE_KEYS.socialsByUser(userId))
  }

  private getVerificationInstructions(platform: SocialPlatform, code: string): string {
    const instructions: Record<SocialPlatform, string> = {
      TWITTER: `Tweet the following: "Verifying my Testnet account! Code: ${code} @TestnetProtocol #Testnet"`,
      TELEGRAM: `Send the following message to @TestnetBot on Telegram: /verify ${code}`,
      DISCORD: `In our Discord server, use the command: /verify ${code}`,
    }
    return instructions[platform]
  }
}

export const socialsService = new SocialsService()
