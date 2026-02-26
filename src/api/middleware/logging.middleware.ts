import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, path } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    logger.info('HTTP Request', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}
