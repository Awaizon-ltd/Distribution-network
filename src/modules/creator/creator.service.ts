import { prisma } from '../../database/client'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors'
import { nodesService } from '../nodes/nodes.service'
import { addNotificationJob } from '../../queue'
import { logger } from '../../utils/logger'
import type { ContentCategory, ScoreSource } from '@prisma/client'

const CREATOR_REWARDS: Record<ContentCategory, { points: number; score: number; reputation: number; source: ScoreSource }> = {
  TWEET:       { points: 50,  score: 25,  reputation: 2, source: 'CREATOR_TWEET' },
  THREAD:      { points: 100, score: 50,  reputation: 3, source: 'CREATOR_THREAD' },
  VIDEO:       { points: 150, score: 75,  reputation: 5, source: 'CREATOR_VIDEO' },
  EDUCATIONAL: { points: 200, score: 100, reputation: 8, source: 'CREATOR_EDUCATIONAL' },
}

const MAX_SUBMISSIONS_PER_DAY = 2
const DUPLICATE_PENALTY = -5

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}

class CreatorService {
  // ─── Apply ───────────────────────────────────────────────────────────────

  async apply(userId: string, twitterUsername: string): Promise<object> {
    const node = await prisma.node.findUnique({ where: { userId }, select: { status: true } })
    if (!node || node.status !== 'ACTIVE') {
      throw new BadRequestError('You must have an active node to apply for the Creator Program')
    }

    const cleanUsername = twitterUsername.replace('@', '').trim()
    const existing = await prisma.creatorProfile.findUnique({ where: { userId } })

    if (existing) {
      if (existing.status === 'PENDING') throw new ConflictError('Your application is already under review')
      if (existing.status === 'APPROVED') throw new ConflictError('You are already an approved creator')

      // REJECTED — allow re-application
      const updated = await prisma.creatorProfile.update({
        where: { userId },
        data: {
          twitterUsername: cleanUsername,
          status: 'PENDING',
          appliedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          approvedAt: null,
          approvedBy: null,
        },
      })
      await prisma.auditLog.create({
        data: { userId, action: 'CREATOR_APPLIED', entity: 'CreatorProfile', entityId: updated.id },
      })
      return { status: updated.status, appliedAt: updated.appliedAt, twitterUsername: updated.twitterUsername }
    }

    const profile = await prisma.creatorProfile.create({
      data: { userId, twitterUsername: cleanUsername },
    })
    await prisma.auditLog.create({
      data: { userId, action: 'CREATOR_APPLIED', entity: 'CreatorProfile', entityId: profile.id },
    })
    return { status: profile.status, appliedAt: profile.appliedAt, twitterUsername: profile.twitterUsername }
  }

  // ─── Get Own Profile ─────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<object | null> {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            tweetUrl: true,
            category: true,
            status: true,
            pointsAwarded: true,
            scoreAwarded: true,
            submittedAt: true,
            rejectionReason: true,
          },
        },
      },
    })
    return profile
  }

  // ─── Submit Content ──────────────────────────────────────────────────────

  async submit(userId: string, tweetUrl: string, category: ContentCategory, description?: string): Promise<object> {
    const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } })
    if (!creatorProfile) throw new ForbiddenError('You must apply and be approved as a Creator first')
    if (creatorProfile.status === 'PENDING') throw new ForbiddenError('Your creator application is still under review')
    if (creatorProfile.status === 'REJECTED') throw new ForbiddenError('Your creator application was not approved')

    const tweetId = extractTweetId(tweetUrl)
    if (!tweetId) {
      throw new BadRequestError('Invalid Twitter/X URL. Expected format: https://twitter.com/user/status/123456789')
    }

    // Daily cap
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayCount = await prisma.creatorSubmission.count({
      where: { userId, submittedAt: { gte: startOfDay } },
    })
    if (todayCount >= MAX_SUBMISSIONS_PER_DAY) {
      throw new BadRequestError(`Daily submission limit reached (${MAX_SUBMISSIONS_PER_DAY} submissions per day)`)
    }

    // Duplicate check — penalty if it's the same user, silent reject if another user already submitted it
    const existingSubmission = await prisma.creatorSubmission.findUnique({ where: { tweetId } })
    if (existingSubmission) {
      if (existingSubmission.userId === userId) {
        await nodesService.adjustReputation(userId, DUPLICATE_PENALTY, 'DUPLICATE_SUBMISSION', { tweetUrl })
        logger.warn(`Duplicate submission by user ${userId}: tweet ${tweetId}`)
        throw new ConflictError('You have already submitted this tweet')
      }
      throw new ConflictError('This tweet has already been submitted by another creator')
    }

    const submission = await prisma.creatorSubmission.create({
      data: {
        creatorId: creatorProfile.id,
        userId,
        tweetUrl,
        tweetId,
        category,
        description: description?.trim() || null,
        status: 'PENDING',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATOR_SUBMISSION_SUBMITTED',
        entity: 'CreatorSubmission',
        entityId: submission.id,
        metadata: { category, tweetUrl },
      },
    })

    return submission
  }

  // ─── List Own Submissions ────────────────────────────────────────────────

  async getSubmissions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [submissions, total] = await Promise.all([
      prisma.creatorSubmission.findMany({
        where: { userId },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.creatorSubmission.count({ where: { userId } }),
    ])
    return { submissions, total }
  }

  // ─── Reward Engine (called by admin on approval) ─────────────────────────

  async issueReward(submissionId: string, adminId: string): Promise<void> {
    const submission = await prisma.creatorSubmission.findUnique({
      where: { id: submissionId },
      include: { creator: true },
    })
    if (!submission) throw new NotFoundError('Submission not found')
    if (submission.rewardIssued) throw new ConflictError('Reward already issued for this submission')
    if (submission.status !== 'APPROVED') throw new BadRequestError('Submission must be APPROVED before reward is issued')

    const rewards = CREATOR_REWARDS[submission.category]

    // Fixed score (multiplierAt=1.0 — equal treatment regardless of node level)
    await nodesService.addCreatorScore(
      submission.userId,
      rewards.score,
      rewards.points,
      rewards.source,
      `Creator reward: ${submission.category.toLowerCase()} content approved`,
      submissionId,
    )

    // Mark submission rewarded
    await prisma.creatorSubmission.update({
      where: { id: submissionId },
      data: {
        rewardIssued: true,
        pointsAwarded: rewards.points,
        scoreAwarded: rewards.score,
        reputationAwarded: rewards.reputation,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    })

    // Reputation boost
    await nodesService.adjustReputation(submission.userId, rewards.reputation, 'CREATOR_REWARD', {
      submissionId,
      category: submission.category,
    })

    await addNotificationJob({
      userId: submission.userId,
      type: 'CREATOR_SUBMISSION_APPROVED',
      title: 'Content Approved!',
      message: `Your ${submission.category.toLowerCase()} was approved. +${rewards.points} points and +${rewards.score} node score earned.`,
      data: { submissionId, category: submission.category, pointsAwarded: rewards.points, scoreAwarded: rewards.score },
    })
  }

  // ─── Bulk Reward ─────────────────────────────────────────────────────────

  async issueBulkRewards(
    submissionIds: string[],
    adminId: string,
  ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const id of submissionIds) {
      try {
        await this.issueReward(id, adminId)
        succeeded++
      } catch (err) {
        failed++
        errors.push(`${id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        logger.error(`Bulk reward failed for submission ${id}:`, err)
      }
    }

    return { succeeded, failed, errors }
  }
}

export const creatorService = new CreatorService()
