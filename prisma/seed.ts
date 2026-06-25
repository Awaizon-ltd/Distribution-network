import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Seed missions
  const missions = [
    {
      title: 'Connect Your Wallet',
      description: 'Connect your Web3 wallet to the Testnet platform',
      type: 'DAILY' as const,
      status: 'ACTIVE' as const,
      points: 100,
    },
    {
      title: 'Activate Your Node',
      description: 'Sign the activation message to bring your Testnet node online',
      type: 'SPECIAL' as const,
      status: 'ACTIVE' as const,
      points: 500,
      bonusPoints: 100,
    },
    {
      title: 'Connect Twitter',
      description: 'Link your X (Twitter) account to earn social bonus points',
      type: 'SOCIAL' as const,
      status: 'ACTIVE' as const,
      points: 200,
    },
    {
      title: 'Connect Discord',
      description: 'Join our Discord and verify your account',
      type: 'SOCIAL' as const,
      status: 'ACTIVE' as const,
      points: 200,
    },
    {
      title: 'Connect Telegram',
      description: 'Join our Telegram community and verify',
      type: 'SOCIAL' as const,
      status: 'ACTIVE' as const,
      points: 200,
    },
    {
      title: 'Make Your First Referral',
      description: 'Invite a friend to join Testnet using your referral code',
      type: 'REFERRAL' as const,
      status: 'ACTIVE' as const,
      points: 300,
    },
    {
      title: 'Daily Check-in',
      description: 'Visit the dashboard daily to earn bonus points',
      type: 'DAILY' as const,
      status: 'ACTIVE' as const,
      points: 50,
    },
    {
      title: 'Weekly Activity',
      description: 'Complete 5 missions in a single week',
      type: 'WEEKLY' as const,
      status: 'ACTIVE' as const,
      points: 500,
      bonusPoints: 250,
      requiredCount: 5,
    },
  ]

  for (const mission of missions) {
    await prisma.mission.upsert({
      where: { id: `seed-${mission.title.toLowerCase().replace(/\s+/g, '-')}` },
      create: { id: `seed-${mission.title.toLowerCase().replace(/\s+/g, '-')}`, ...mission },
      update: {},
    })
  }

  // Seed system config
  await prisma.systemConfig.upsert({
    where: { key: 'platform_settings' },
    create: {
      key: 'platform_settings',
      value: {
        mainnetLaunch: false,
        nodeActivationEnabled: true,
        referralEnabled: true,
        weeklyResetDay: 1,
      },
    },
    update: {},
  })

  console.log(`Seeded ${missions.length} missions`)
  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
