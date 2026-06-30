export interface NodeLevel {
  level: number
  title: string
  minScore: number
  maxScore: number | null
  multiplier: number
  color: string
  tier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC'
  description: string
}

// Score values awarded per action (fixed, never multiplied)
export const SCORE_VALUES = {
  MISSION_DAILY: 20,
  MISSION_WEEKLY: 100,
  MISSION_SPECIAL: 250,
  MISSION_COMMUNITY: 75,
  MISSION_REFERRAL: 150,
  MISSION_SOCIAL: 50,
  REFERRAL_ACTIVATION: 500,
  SOCIAL_CONNECT: 200,
  CHECK_IN: 20,
  NODE_ACTIVATION: 500,
  // Achievements are defined individually in achievements.definitions.ts
} as const

// Referral milestones — each triggers bonus score and an achievement
export const REFERRAL_MILESTONES = [
  { count: 1,    scoreBonus: 100,    achievementKey: 'referrals_1' },
  { count: 5,    scoreBonus: 500,    achievementKey: 'referrals_5' },
  { count: 10,   scoreBonus: 1_000,  achievementKey: 'referrals_10' },
  { count: 25,   scoreBonus: 2_500,  achievementKey: 'referrals_25' },
  { count: 50,   scoreBonus: 5_000,  achievementKey: 'referrals_50' },
  { count: 100,  scoreBonus: 10_000, achievementKey: 'referrals_100' },
  { count: 250,  scoreBonus: 25_000, achievementKey: 'referrals_250' },
  { count: 500,  scoreBonus: 50_000, achievementKey: 'referrals_500' },
  { count: 1000, scoreBonus: 100_000, achievementKey: 'referrals_1000' },
] as const

// 20-level progression system
// Designed so that:
//   - Levels 1-4 are reachable through regular daily activity
//   - Levels 5-9 require sustained engagement + referrals
//   - Levels 10-15 represent top-tier contributors
//   - Levels 16-20 are reserved for ecosystem titans
export const NODE_LEVELS: NodeLevel[] = [
  {
    level: 1,
    title: 'Explorer',
    minScore: 0,
    maxScore: 999,
    multiplier: 1.0,
    color: '#888888',
    tier: 'COMMON',
    description: 'Your journey begins. Explore the ecosystem.',
  },
  {
    level: 2,
    title: 'Pioneer',
    minScore: 1_000,
    maxScore: 4_999,
    multiplier: 1.1,
    color: '#4a90d9',
    tier: 'COMMON',
    description: 'You are blazing a trail in the network.',
  },
  {
    level: 3,
    title: 'Operator',
    minScore: 5_000,
    maxScore: 14_999,
    multiplier: 1.25,
    color: '#5bb85d',
    tier: 'UNCOMMON',
    description: 'A trusted participant in the Testnet ecosystem.',
  },
  {
    level: 4,
    title: 'Guardian',
    minScore: 15_000,
    maxScore: 49_999,
    multiplier: 1.5,
    color: '#f0ad4e',
    tier: 'UNCOMMON',
    description: 'You protect and strengthen the network.',
  },
  {
    level: 5,
    title: 'Architect',
    minScore: 50_000,
    maxScore: 99_999,
    multiplier: 1.75,
    color: '#e07b39',
    tier: 'RARE',
    description: 'You are building the foundations of the ecosystem.',
  },
  {
    level: 6,
    title: 'Sentinel',
    minScore: 100_000,
    maxScore: 199_999,
    multiplier: 2.0,
    color: '#d44f4f',
    tier: 'RARE',
    description: 'A vigilant guardian of the protocol.',
  },
  {
    level: 7,
    title: 'Vanguard',
    minScore: 200_000,
    maxScore: 399_999,
    multiplier: 2.25,
    color: '#c0392b',
    tier: 'RARE',
    description: 'Leading the charge at the frontier.',
  },
  {
    level: 8,
    title: 'Enforcer',
    minScore: 400_000,
    maxScore: 749_999,
    multiplier: 2.5,
    color: '#8e44ad',
    tier: 'EPIC',
    description: 'Your authority within the network is undeniable.',
  },
  {
    level: 9,
    title: 'Catalyst',
    minScore: 750_000,
    maxScore: 1_249_999,
    multiplier: 2.75,
    color: '#6c3483',
    tier: 'EPIC',
    description: 'You accelerate the growth of the entire ecosystem.',
  },
  {
    level: 10,
    title: 'Commander',
    minScore: 1_250_000,
    maxScore: 1_999_999,
    multiplier: 3.0,
    color: '#1a5276',
    tier: 'EPIC',
    description: 'You command the respect of the entire network.',
  },
  {
    level: 11,
    title: 'Sovereign',
    minScore: 2_000_000,
    maxScore: 3_249_999,
    multiplier: 3.25,
    color: '#0e6655',
    tier: 'LEGENDARY',
    description: 'Absolute authority. A pillar of the ecosystem.',
  },
  {
    level: 12,
    title: 'Warden',
    minScore: 3_250_000,
    maxScore: 4_999_999,
    multiplier: 3.5,
    color: '#1e8449',
    tier: 'LEGENDARY',
    description: 'Keeper of the network\'s integrity and growth.',
  },
  {
    level: 13,
    title: 'Oracle',
    minScore: 5_000_000,
    maxScore: 7_499_999,
    multiplier: 3.75,
    color: '#b7950b',
    tier: 'LEGENDARY',
    description: 'Your insight guides the protocol forward.',
  },
  {
    level: 14,
    title: 'Phantom',
    minScore: 7_500_000,
    maxScore: 10_999_999,
    multiplier: 4.0,
    color: '#a04000',
    tier: 'LEGENDARY',
    description: 'An ethereal force within the network.',
  },
  {
    level: 15,
    title: 'Mythic',
    minScore: 11_000_000,
    maxScore: 15_999_999,
    multiplier: 4.25,
    color: '#922b21',
    tier: 'MYTHIC',
    description: 'Your contributions have become the stuff of legend.',
  },
  {
    level: 16,
    title: 'Legend',
    minScore: 16_000_000,
    maxScore: 22_999_999,
    multiplier: 4.5,
    color: '#6e2f1a',
    tier: 'MYTHIC',
    description: 'A name inscribed permanently in the network\'s history.',
  },
  {
    level: 17,
    title: 'Apex',
    minScore: 23_000_000,
    maxScore: 32_999_999,
    multiplier: 4.75,
    color: '#1c2833',
    tier: 'MYTHIC',
    description: 'The apex of human contribution to the ecosystem.',
  },
  {
    level: 18,
    title: 'Titan',
    minScore: 33_000_000,
    maxScore: 46_999_999,
    multiplier: 5.0,
    color: '#17202a',
    tier: 'MYTHIC',
    description: 'You move the ecosystem with every action.',
  },
  {
    level: 19,
    title: 'Ascendant',
    minScore: 47_000_000,
    maxScore: 66_999_999,
    multiplier: 5.25,
    color: '#FFD60A',
    tier: 'MYTHIC',
    description: 'Transcending the limits of participation.',
  },
  {
    level: 20,
    title: 'Genesis',
    minScore: 67_000_000,
    maxScore: null,
    multiplier: 5.5,
    color: '#FFFFFF',
    tier: 'MYTHIC',
    description: 'The original. The source. The beginning of everything.',
  },
]

// Pure functions — no DB dependencies, safe to import anywhere

export const getLevelForScore = (score: number): NodeLevel => {
  for (let i = NODE_LEVELS.length - 1; i >= 0; i--) {
    if (score >= NODE_LEVELS[i].minScore) return NODE_LEVELS[i]
  }
  return NODE_LEVELS[0]
}

export const getMultiplierForScore = (score: number): number => {
  return getLevelForScore(score).multiplier
}

export const calculateProgressToNextLevel = (score: number): {
  currentLevel: NodeLevel
  nextLevel: NodeLevel | null
  progressPercent: number
  scoreInCurrentLevel: number
  scoreNeededForNext: number | null
} => {
  const currentLevel = getLevelForScore(score)
  const nextLevel = NODE_LEVELS[currentLevel.level] ?? null // level is 1-based, array is 0-based

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      progressPercent: 100,
      scoreInCurrentLevel: score - currentLevel.minScore,
      scoreNeededForNext: null,
    }
  }

  const scoreInLevel = score - currentLevel.minScore
  const levelRange = nextLevel.minScore - currentLevel.minScore
  const progressPercent = Math.min(100, (scoreInLevel / levelRange) * 100)

  return {
    currentLevel,
    nextLevel,
    progressPercent,
    scoreInCurrentLevel: scoreInLevel,
    scoreNeededForNext: nextLevel.minScore - score,
  }
}

// Minimum reputation required for referral rewards to be issued
export const MIN_REPUTATION_FOR_REWARDS = 50

// Reputation change amounts
export const REPUTATION_CHANGES = {
  MISSION_COMPLETED: 1,
  SOCIAL_CONNECTED: 2,
  REFERRAL_VERIFIED: 3,
  SUSPICIOUS_IP: -10,
  FAKE_REFERRAL_DETECTED: -20,
  ABUSE_DETECTED: -25,
  ADMIN_ADJUSTMENT: 0,   // variable
  ACCOUNT_ACTIVITY: 1,
} as const
