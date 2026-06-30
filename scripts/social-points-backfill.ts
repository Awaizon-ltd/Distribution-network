/**
 * One-time backfill: adds 150 points per verified social connection to compensate
 * for the old SOCIAL_CONNECT score value of 50 (now 200).
 *
 * Run from the backend directory:
 *   npx tsx scripts/social-points-backfill.ts
 *
 * Safe to re-run: each run creates new PointTransaction rows, so only run once.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BONUS_PER_SOCIAL = 150

async function main() {
  const connections = await prisma.socialConnection.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true, platform: true },
  })

  if (connections.length === 0) {
    console.log('No verified social connections found. Nothing to do.')
    return
  }

  // Group platforms by userId
  const byUser = new Map<string, string[]>()
  for (const c of connections) {
    const list = byUser.get(c.userId) ?? []
    list.push(c.platform)
    byUser.set(c.userId, list)
  }

  console.log(`Backfilling ${connections.length} social connections across ${byUser.size} users (+${BONUS_PER_SOCIAL} pts each)...`)

  let processed = 0
  for (const [userId, platforms] of byUser) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: platforms.length * BONUS_PER_SOCIAL } },
      }),
      ...platforms.map((platform) =>
        prisma.pointTransaction.create({
          data: {
            userId,
            amount: BONUS_PER_SOCIAL,
            type: 'POINTS',
            description: `Social reward correction — ${platform}`,
            source: 'SOCIAL_CONNECT',
          },
        }),
      ),
    ])

    processed++
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${byUser.size} users processed...`)
    }
  }

  console.log(`Done. +${BONUS_PER_SOCIAL} pts added per social for ${connections.length} connections (${processed} users).`)
  console.log('Remember to flush the Redis leaderboard cache after running this script.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
