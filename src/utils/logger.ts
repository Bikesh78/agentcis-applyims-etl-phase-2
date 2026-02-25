import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from 'config';
import { LoggerConfig } from 'configs/logger.config.js';

export interface Logger {
  info(message: string, meta?: object): void;
  error(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  debug(message: string, meta?: object): void;
}

const loggerConfig = config.get<LoggerConfig>('logger');
const { logDir, logLevel } = loggerConfig;

export const logLevels = ['info', 'error', 'warn', 'debug'] as const;

const dailyRotateTransport = new DailyRotateFile({
  filename: 'migration-%DATE%.log',
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '30d',
  level: logLevel,
});

const errorDailyRotateTransport = new DailyRotateFile({
  filename: 'error-%DATE%.log',
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '90d',
  level: 'error',
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize({ all: true }), winston.format.simple()),
});

const transports = [dailyRotateTransport, errorDailyRotateTransport, consoleTransport];

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.errors({ stack: true })
);

const winstonLogger = winston.createLogger({
  level: logLevel,
  format,
  transports,
});

export const logger: Logger = {
  info: (message: string, meta?: object) => {
    winstonLogger.info(message, meta);
  },
  error: (message: string, meta?: object) => {
    winstonLogger.error(message, meta);
  },
  warn: (message: string, meta?: object) => {
    winstonLogger.warn(message, meta);
  },
  debug: (message: string, meta?: object) => {
    winstonLogger.debug(message, meta);
  },
};
