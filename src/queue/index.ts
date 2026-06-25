import { Queue, QueueOptions } from 'bullmq'
import { bullConnectionOptions } from '../config/bull-connection'

const queueOptions: QueueOptions = {
  connection: bullConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
}

export const referralQueue = new Queue('referral-processing', queueOptions)
export const rankingQueue = new Queue('ranking-recalculation', queueOptions)
export const notificationQueue = new Queue('notification-delivery', queueOptions)
export const rewardQueue = new Queue('reward-distribution', queueOptions)
export const weeklyResetQueue = new Queue('weekly-reset', queueOptions)
export const achievementQueue = new Queue('achievement-check', queueOptions)

export const queues = {
  referral: referralQueue,
  ranking: rankingQueue,
  notification: notificationQueue,
  reward: rewardQueue,
  weeklyReset: weeklyResetQueue,
  achievement: achievementQueue,
}

export const addReferralJob = (data: { referralId: string }) =>
  referralQueue.add('process-referral', data, { delay: 5000 })

export const addRankingJob = () =>
  rankingQueue.add('recalculate-ranks', {}, { jobId: 'singleton-rank', removeOnComplete: true })

export const addNotificationJob = (data: {
  userId: string
  type: string
  title: string
  message: string
  data?: object
}) => notificationQueue.add('deliver-notification', data)

export const addWeeklyResetJob = () =>
  weeklyResetQueue.add('reset-weekly', {}, { jobId: 'weekly-reset', removeOnComplete: true })

export const addAchievementCheckJob = (data: { userId: string; source: string; newScore?: number; level?: number }) =>
  achievementQueue.add('check-achievements', data)
