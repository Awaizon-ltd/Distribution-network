import https from 'https'
import { prisma } from '../../database/client'
import { creatorService } from '../creator/creator.service'
import { nodesService } from '../nodes/nodes.service'
import { addNotificationJob } from '../../queue'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors'
import { logger } from '../../utils/logger'

// ─── Twitter oEmbed ───────────────────────────────────────────────────────────

async function fetchOembed(tweetUrl: string): Promise<object | null> {
  return new Promise((resolve) => {
    const url = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`
    const req = https.get(url, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(body) : null)
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(5000, () => { req.destroy(); resolve(null) })
  })
}

// ─── Service ──────────────────────────────────────────────────────────────────

class AdminCreatorService {
  // ─── Applications ─────────────────────────────────────────────────────────

  async listApplications(status?: string, page = 1, limit = 50) {
    const where = status ? { status: status as never } : {}
    const [applications, total] = await Promise.all([
      prisma.creatorProfile.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              walletAddress: true,
              status: true,
              totalPoints: true,
              node: { select: { status: true, nodeLevel: true, nodeReputation: true } },
              _count: { select: { creatorSubmissions: true } },
            },
          },
        },
      }),
      prisma.creatorProfile.count({ where }),
    ])
    return { applications, total }
  }

  async approveApplication(creatorProfileId: string, adminId: string): Promise<void> {
    const profile = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      select: { id: true, userId: true, status: true, twitterUsername: true },
    })
    if (!profile) throw new NotFoundError('Creator application not found')
    if (profile.status === 'APPROVED') throw new ConflictError('Application already approved')

    await prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: adminId },
    })

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_APPROVED',
        entity: 'CreatorProfile',
        entityId: creatorProfileId,
        metadata: { twitterUsername: profile.twitterUsername },
      },
    })

    await addNotificationJob({
      userId: profile.userId,
      type: 'CREATOR_APPROVED',
      title: 'Creator Application Approved!',
      message: `Congratulations! Your Creator Program application has been approved. You can now submit content for rewards.`,
      data: { twitterUsername: profile.twitterUsername },
    })
  }

  async rejectApplication(creatorProfileId: string, adminId: string, reason: string): Promise<void> {
    const profile = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      select: { id: true, userId: true, status: true },
    })
    if (!profile) throw new NotFoundError('Creator application not found')
    if (profile.status === 'REJECTED') throw new ConflictError('Application already rejected')

    await prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
    })

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_REJECTED',
        entity: 'CreatorProfile',
        entityId: creatorProfileId,
        metadata: { reason },
      },
    })

    await addNotificationJob({
      userId: profile.userId,
      type: 'CREATOR_APPROVED',
      title: 'Creator Application Update',
      message: `Your Creator Program application was not approved. Reason: ${reason}`,
      data: { reason },
    })
  }

  // ─── Submissions ──────────────────────────────────────────────────────────

  async listSubmissions(filters: { status?: string; category?: string } = {}, page = 1, limit = 50) {
    const where: Record<string, unknown> = {}
    if (filters.status) where.status = filters.status
    if (filters.category) where.category = filters.category

    const [submissions, total] = await Promise.all([
      prisma.creatorSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { twitterUsername: true, status: true } },
          user: { select: { walletAddress: true } },
        },
      }),
      prisma.creatorSubmission.count({ where }),
    ])
    return { submissions, total }
  }

  async getSubmission(id: string): Promise<object> {
    const submission = await prisma.creatorSubmission.findUnique({
      where: { id },
      include: {
        creator: { select: { twitterUsername: true, status: true } },
        user: {
          select: {
            walletAddress: true,
            node: { select: { nodeLevel: true, nodeReputation: true, nodeScore: true } },
          },
        },
      },
    })
    if (!submission) throw new NotFoundError('Submission not found')

    // Fetch tweet preview (best-effort, non-blocking on failure)
    const oembed = await fetchOembed(submission.tweetUrl)

    return { ...submission, oembed }
  }

  async approveSubmission(id: string, adminId: string): Promise<void> {
    const submission = await prisma.creatorSubmission.findUnique({
      where: { id },
      select: { id: true, status: true, rewardIssued: true },
    })
    if (!submission) throw new NotFoundError('Submission not found')
    if (submission.status === 'APPROVED') throw new ConflictError('Submission already approved')
    if (submission.status === 'REJECTED') throw new BadRequestError('Cannot approve a rejected submission')

    // Set status first, then issue reward
    await prisma.creatorSubmission.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: { userId: adminId, action: 'CREATOR_SUBMISSION_APPROVED', entity: 'CreatorSubmission', entityId: id },
    })

    // Issue reward (handles points, score, reputation, notification)
    await creatorService.issueReward(id, adminId)
  }

  async rejectSubmission(id: string, adminId: string, reason: string, applyPenalty = false): Promise<void> {
    const submission = await prisma.creatorSubmission.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, category: true },
    })
    if (!submission) throw new NotFoundError('Submission not found')
    if (submission.status === 'REJECTED') throw new ConflictError('Submission already rejected')
    if (submission.status === 'APPROVED') throw new BadRequestError('Cannot reject an approved submission')

    await prisma.creatorSubmission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        penaltyApplied: applyPenalty,
        penaltyReason: applyPenalty ? reason : null,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_SUBMISSION_REJECTED',
        entity: 'CreatorSubmission',
        entityId: id,
        metadata: { reason, penaltyApplied: applyPenalty },
      },
    })

    if (applyPenalty) {
      await nodesService.adjustReputation(submission.userId, -10, 'SPAM_SUBMISSION', { submissionId: id, reason })
      logger.warn(`Spam penalty applied to user ${submission.userId} for submission ${id}`)
    }

    await addNotificationJob({
      userId: submission.userId,
      type: 'CREATOR_SUBMISSION_REJECTED',
      title: 'Submission Not Approved',
      message: `Your ${submission.category.toLowerCase()} submission was not approved. Reason: ${reason}`,
      data: { submissionId: id, reason },
    })
  }

  async bulkApproveSubmissions(ids: string[], adminId: string) {
    if (ids.length === 0) throw new BadRequestError('No submission IDs provided')
    if (ids.length > 50) throw new BadRequestError('Maximum 50 submissions per bulk operation')

    // Set all to APPROVED first (skip already approved/rejected)
    const pending = await prisma.creatorSubmission.findMany({
      where: { id: { in: ids }, status: 'PENDING' },
      select: { id: true },
    })
    const pendingIds = pending.map((s) => s.id)

    if (pendingIds.length === 0) throw new BadRequestError('No pending submissions found in the provided IDs')

    await prisma.creatorSubmission.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_BULK_APPROVED',
        entity: 'CreatorSubmission',
        metadata: { count: pendingIds.length, ids: pendingIds },
      },
    })

    // Issue rewards — continues on individual failure
    const result = await creatorService.issueBulkRewards(pendingIds, adminId)

    return {
      submitted: ids.length,
      eligible: pendingIds.length,
      ...result,
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getCreatorStats() {
    const [
      totalApplications,
      pendingApplications,
      approvedCreators,
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
    ] = await Promise.all([
      prisma.creatorProfile.count(),
      prisma.creatorProfile.count({ where: { status: 'PENDING' } }),
      prisma.creatorProfile.count({ where: { status: 'APPROVED' } }),
      prisma.creatorSubmission.count(),
      prisma.creatorSubmission.count({ where: { status: 'PENDING' } }),
      prisma.creatorSubmission.count({ where: { status: 'APPROVED' } }),
      prisma.creatorSubmission.count({ where: { status: 'REJECTED' } }),
    ])

    return {
      applications: { total: totalApplications, pending: pendingApplications, approved: approvedCreators },
      submissions: {
        total: totalSubmissions,
        pending: pendingSubmissions,
        approved: approvedSubmissions,
        rejected: rejectedSubmissions,
      },
    }
  }
}

export const adminCreatorService = new AdminCreatorService()
