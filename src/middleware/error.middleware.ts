import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Unexpected error:', { error: err.message, stack: err.stack, path: req.path })
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.flatten().fieldErrors,
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Resource already exists',
      })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Resource not found',
      })
      return
    }
  }

  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  })
}
