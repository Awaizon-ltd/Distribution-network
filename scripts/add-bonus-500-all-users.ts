/**
 * One-time bonus: adds 500 points to every user.
 *
 * Run from the backend directory:
 *   npx tsx --env-file=.env scripts/add-bonus-500-all-users.ts
 *
 * Safe to re-run only if you intend to give the bonus twice — each run
 * creates a new PointTransaction row per user.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BONUS = 500
const BATCH = 100

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } })

  if (users.length === 0) {
    console.log('No users found.')
    return
  }

  console.log(`Adding +${BONUS} pts to ${users.length} users in batches of ${BATCH}...`)

  let processed = 0

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH)

    await prisma.$transaction(
      batch.flatMap(({ id: userId }) => [
        prisma.pointTransaction.create({
          data: {
            userId,
            amount: BONUS,
            source: 'ADMIN_BONUS',
            description: 'Community bonus — +500 pts added by admin',
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            totalPoints: { increment: BONUS },
            weeklyPoints: { increment: BONUS },
          },
        }),
      ]),
    )

    processed += batch.length
    console.log(`  ${processed}/${users.length} done`)
  }

  console.log(`\nDone. +${BONUS} pts added to all ${processed} users.`)
  console.log('Leaderboard/Redis caches will update on next request or restart.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
