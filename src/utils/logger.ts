import winston from 'winston'
import { config } from '../config'

const { combine, timestamp, errors, json, colorize, simple } = winston.format

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  simple(),
)

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
)

export const logger = winston.createLogger({
  level: config.log.level,
  format: config.isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
    ...(config.isProd
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
})
