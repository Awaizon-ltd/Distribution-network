import { Router } from 'express'
import { newsController } from './news.controller'

const router = Router()

router.get('/', newsController.getAll.bind(newsController))
router.get('/slug/:slug', newsController.getBySlug.bind(newsController))
router.get('/:id', newsController.getById.bind(newsController))

export default router
