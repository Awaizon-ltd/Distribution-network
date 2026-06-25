import { config } from './index'

function parseBullRedisUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname || 'localhost',
    port: parseInt(u.port || '6379', 10),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.pathname && u.pathname !== '/' ? { db: parseInt(u.pathname.slice(1), 10) } : {}),
  }
}

export const bullConnectionOptions = parseBullRedisUrl(config.redis.url)
