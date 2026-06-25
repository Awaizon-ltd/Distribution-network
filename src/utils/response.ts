import { Response } from 'express'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: ApiResponse['meta'],
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    meta,
  } satisfies ApiResponse<T>)
}

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  error?: string,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  } satisfies ApiResponse)
}

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  } satisfies ApiResponse<T[]>)
}
