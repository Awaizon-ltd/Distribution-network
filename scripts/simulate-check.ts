import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  // ─── 1. Node schema check ───────────────────────────────────────────────
  console.log('\n=== NODE SCHEMA CHECK ===')
  try {
    const node = await p.node.findFirst({
      select: {
        id: true,
        status: true,
        nodeScore: true,
        nodeLevel: true,
        checkInStreak: true,
        lastCheckInAt: true,
      },
    })
    if (node) {
      console.log('✓ checkInStreak column EXISTS — value:', node.checkInStreak)
      console.log('✓ lastCheckInAt column EXISTS — value:', node.lastCheckInAt)
      console.log('  nodeScore:', node.nodeScore.toString(), '| nodeLevel:', node.nodeLevel, '| status:', node.status)
    } else {
      console.log('No nodes in DB yet — schema fields assumed OK if no error thrown')
    }
  } catch (e: any) {
    console.error('✗ Node schema error:', e.message)
    console.error('  → The new columns (checkInStreak, lastCheckInAt) have NOT been pushed to prod DB yet')
    console.error('  → Run: npx prisma db push  (from a context that can reach the DB)')
  }

  // ─── 2. Referral summary ────────────────────────────────────────────────
  console.log('\n=== REFERRAL SUMMARY ===')
  const [total, rewarded, pending] = await Promise.all([
    p.referral.count(),
    p.referral.count({ where: { rewardIssued: true } }),
    p.referral.count({ where: { rewardIssued: false } }),
  ])
  console.log(`Total: ${total}  |  Rewarded: ${rewarded}  |  Pending (awaiting node activation): ${pending}`)

  // ─── 3. All referrals detail ─────────────────────────────────────────────
  console.log('\n=== REFERRAL DETAIL (newest first) ===')
  const refs = await p.referral.findMany({
    select: {
      id: true,
      rewardIssued: true,
      pointsEarned: true,
      createdAt: true,
      referrer: { select: { walletAddress: true, totalPoints: true } },
      referee:  { select: { walletAddress: true, node: { select: { status: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  for (const r of refs) {
    const nodeStatus = r.referee?.node?.status ?? 'NO_NODE'
    const eligible = nodeStatus === 'ACTIVE' && !r.rewardIssued
    console.log(
      r.createdAt.toISOString().slice(0, 10),
      '|', r.rewardIssued ? '✓ REWARDED' : (eligible ? '⚠ ELIGIBLE-NOT-REWARDED' : '○ PENDING'),
      '| pts:', r.pointsEarned,
      '| node:', nodeStatus.padEnd(9),
      '| referrer:', r.referrer?.walletAddress?.slice(0, 14),
      '| referee:', r.referee?.walletAddress?.slice(0, 14),
    )
  }

  // ─── 4. Stuck referrals (node ACTIVE but reward not issued) ─────────────
  console.log('\n=== STUCK REFERRALS (node active, reward NOT issued) ===')
  const stuck = await p.referral.findMany({
    where: { rewardIssued: false, referee: { node: { status: 'ACTIVE' } } },
    select: {
      id: true,
      referrer: { select: { walletAddress: true } },
      referee:  { select: { walletAddress: true } },
    },
  })
  if (stuck.length === 0) {
    console.log('✓ None — all active-node referrals have been rewarded')
  } else {
    console.log(`✗ Found ${stuck.length} stuck referral(s):`)
    stuck.forEach(r => {
      console.log('  id:', r.id)
      console.log('  referrer:', r.referrer.walletAddress)
      console.log('  referee:', r.referee.walletAddress)
    })
  }

  // ─── 5. Referral code validation spot-check ──────────────────────────────
  console.log('\n=== TOP REFERRERS ===')
  const topReferrers = await p.user.findMany({
    where: { referralsMade: { some: {} } },
    select: {
      walletAddress: true,
      referralPoints: true,
      _count: { select: { referralsMade: true } },
    },
    orderBy: { _count: { referralsMade: 'desc' } },
    take: 10,
  })
  topReferrers.forEach(u =>
    console.log(
      u.walletAddress.slice(0, 14),
      '| referrals:', u._count.referralsMade,
      '| referralPoints:', u.referralPoints.toString(),
    )
  )
}

main().catch(console.error).finally(() => p.$disconnect())
