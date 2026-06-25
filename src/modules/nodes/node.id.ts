import { randomBytes } from 'crypto'
import { prisma } from '../../database/client'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const randomLetters = (n: number): string =>
  Array.from({ length: n }, () => LETTERS[Math.floor(Math.random() * 26)]).join('')

const randomDigits = (n: number): string => {
  const min = Math.pow(10, n - 1)
  const max = Math.pow(10, n) - 1
  return String(Math.floor(min + Math.random() * (max - min + 1)))
}

export const generateNodeId = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = `${randomLetters(3)}-${randomDigits(6)}`
    const existing = await prisma.node.findUnique({ where: { nodeId: id } })
    if (!existing) return id
  }
  // Fallback: use crypto randomBytes for guaranteed uniqueness
  const hex = randomBytes(4).toString('hex').toUpperCase()
  return `TN-${hex}`
}
