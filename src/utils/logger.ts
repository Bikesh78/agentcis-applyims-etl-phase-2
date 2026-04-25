import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from 'config';
import { LoggerConfig } from 'configs/logger.config.js';

export interface LoggerMetadata {
  migrationId?: string;
  entityType?: string;
  [key: string]: any;
}

export interface Logger {
  info(message: string, meta?: LoggerMetadata): void;
  error(message: string, meta?: LoggerMetadata): void;
  warn(message: string, meta?: LoggerMetadata): void;
  debug(message: string, meta?: LoggerMetadata): void;
  progress(message: string, meta?: LoggerMetadata): void;
}

const loggerConfig = config.get<LoggerConfig>('logger');
const { logDir, logLevel } = loggerConfig;

export const logLevels = ['info', 'error', 'warn', 'debug', 'progress'] as const;

winston.addColors({
  progress: 'cyan',
});

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
  levels: {
    error: 0,
    warn: 1,
    progress: 2,
    info: 3,
    debug: 4,
  },
});

export const logger: Logger = {
  info: (message: string, meta?: LoggerMetadata) => {
    winstonLogger.info(message, meta);
  },
  error: (message: string, meta?: LoggerMetadata) => {
    winstonLogger.error(message, meta);
  },
  warn: (message: string, meta?: LoggerMetadata) => {
    winstonLogger.warn(message, meta);
  },
  debug: (message: string, meta?: LoggerMetadata) => {
    winstonLogger.debug(message, meta);
  },
  progress: (message: string, meta?: LoggerMetadata) => {
    winstonLogger.log('progress', message, meta);
  },
};
