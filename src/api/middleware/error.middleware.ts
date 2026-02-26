import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
}
