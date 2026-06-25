import { randomBytes } from 'crypto'
import { prisma } from '../database/client'

export const generateReferralCode = async (): Promise<string> => {
  const maxAttempts = 10
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    const exists = await prisma.user.findUnique({ where: { referralCode: code } })
    if (!exists) return code
  }
  // Fallback: use longer code
  return randomBytes(8).toString('hex').toUpperCase()
}
