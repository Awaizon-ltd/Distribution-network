/**
 * Finds all referrals where the referee's node is ACTIVE but the reward was
 * never issued, then processes each one via the referrals service.
 *
 * Run from the backend directory:
 *   npx tsx scripts/process-stuck-referrals.ts
 */

/**
 * Bypasses nodesService (which queries the new checkInStreak column that doesn't
 * exist in prod yet). Awards points directly via prisma + updates user.totalPoints
 * and user.referralPoints inline.
 */
import { PrismaClient } from '@prisma/client'
import { redis, CACHE_KEYS } from '../src/cache/redis'

const prisma = new PrismaClient()
const REFERRAL_POINTS = 100  // config.rewards.referralPoints

async function main() {
  // Fetch without selecting node columns that don't exist in prod
  const stuck = await prisma.referral.findMany({
    where: { rewardIssued: false },
    select: {
      id: true,
      referrerId: true,
      refereeId: true,
      referrer: { select: { walletAddress: true } },
      referee:  { select: {
        walletAddress: true,
        // Only query referee's node status — avoid node model for now
      }},
    },
  })

  // Filter: only process those whose referee has an active node
  // Use a raw query to avoid the missing-column issue
  const activeRefereeIds: string[] = (await prisma.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM nodes WHERE status = 'ACTIVE'
  `).map(r => r.userId)

  const eligible = stuck.filter(r => activeRefereeIds.includes(r.refereeId))

  if (eligible.length === 0) {
    console.log('No eligible stuck referrals (no active-node referee). Nothing to do.')
    return
  }

  console.log(`Processing ${eligible.length} stuck referral(s)...\n`)

  for (const ref of eligible) {
    console.log(`Referral ${ref.id}`)
    console.log(`  Referrer: ${ref.referrer.walletAddress}`)
    console.log(`  Referee:  ${ref.referee.walletAddress}`)

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Mark referral as rewarded
        await tx.referral.update({
          where: { id: ref.id },
          data: {
            rewardIssued: true,
            rewardedAt: new Date(),
            pointsEarned: REFERRAL_POINTS,
          },
        })

        // 2. Credit points to referrer's total balance
        await tx.user.update({
          where: { id: ref.referrerId },
          data: {
            totalPoints:    { increment: REFERRAL_POINTS },
            referralPoints: { increment: REFERRAL_POINTS },
          },
        })

        // 3. Record the transaction in the activity log
        await tx.pointTransaction.create({
          data: {
            userId:      ref.referrerId,
            amount:      REFERRAL_POINTS,
            type:        'POINTS',
            description: `Referral reward: ${ref.referee.walletAddress.slice(0, 10)}...`,
            source:      'REFERRAL',
            sourceId:    ref.id,
          },
        })
      })

      // 4. Bust cache for this referrer
      await redis.del(CACHE_KEYS.userById(ref.referrerId))

      console.log(`  ✓ Rewarded +${REFERRAL_POINTS} pts to referrer`)
    } catch (err: any) {
      console.error(`  ✗ Failed:`, err.message)
    }

    console.log()
  }

  const [total, rewarded] = await Promise.all([
    prisma.referral.count(),
    prisma.referral.count({ where: { rewardIssued: true } }),
  ])
  console.log(`=== FINAL STATE: ${rewarded}/${total} referrals rewarded ===`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
