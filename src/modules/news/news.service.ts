import { Prisma } from '@prisma/client'
import { prisma } from '../../database/client'
import { redis, CACHE_KEYS } from '../../cache/redis'
import { config } from '../../config'
import { NotFoundError } from '../../utils/errors'

type NewsListSelect = Prisma.NewsGetPayload<{
  select: {
    id: true; title: true; slug: true; excerpt: true; imageUrl: true
    category: true; tags: true; publishedAt: true; viewCount: true
  }
}>
type PublishedNewsResult = { news: NewsListSelect[]; total: number }

class NewsService {
  async getPublishedNews(page = 1, limit = 20, category?: string): Promise<PublishedNewsResult> {
    const cacheKey = `${CACHE_KEYS.newsLatest}:${page}:${limit}:${category ?? 'all'}`
    const cached = await redis.get<PublishedNewsResult>(cacheKey)
    if (cached) return cached

    const where = {
      status: 'PUBLISHED' as const,
      ...(category ? { category: category as never } : {}),
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          imageUrl: true,
          category: true,
          tags: true,
          publishedAt: true,
          viewCount: true,
        },
      }),
      prisma.news.count({ where }),
    ])

    const result = { news, total }
    await redis.set(cacheKey, result, config.cache.newsTTL)
    return result
  }

  async getNewsById(id: string) {
    const cached = await redis.get(CACHE_KEYS.newsById(id))
    if (cached) return cached

    const article = await prisma.news.findFirst({
      where: { id, status: 'PUBLISHED' },
    })
    if (!article) throw new NotFoundError('News article not found')

    // Increment view count asynchronously
    prisma.news.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    await redis.set(CACHE_KEYS.newsById(id), article, config.cache.newsTTL)
    return article
  }

  async getNewsBySlug(slug: string) {
    const article = await prisma.news.findFirst({
      where: { slug, status: 'PUBLISHED' },
    })
    if (!article) throw new NotFoundError('News article not found')

    prisma.news.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})
    return article
  }

  async createNews(data: {
    title: string
    slug: string
    excerpt: string
    content: string
    category: string
    imageUrl?: string
    tags?: string[]
    authorId?: string
  }) {
    const article = await prisma.news.create({ data: data as never })
    await redis.invalidatePattern('news:*')
    return article
  }

  async publishNews(id: string) {
    const article = await prisma.news.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    await redis.invalidatePattern('news:*')
    return article
  }

  async updateNews(id: string, data: object) {
    const article = await prisma.news.update({ where: { id }, data: data as never })
    await redis.invalidatePattern('news:*')
    return article
  }

  async deleteNews(id: string) {
    await prisma.news.update({ where: { id }, data: { status: 'ARCHIVED' } })
    await redis.invalidatePattern('news:*')
  }
}

export const newsService = new NewsService()
