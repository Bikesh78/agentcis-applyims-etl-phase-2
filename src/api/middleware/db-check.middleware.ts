import { Request, Response, NextFunction } from 'express';
import { getDatabaseConnection } from '../../configs/database.config.js';

export function dbCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  const dbConnections = getDatabaseConnection();

  if (!dbConnections?.agentcisDb || !dbConnections?.etlDb) {
    res.status(503).json({
      status: 'error',
      message: 'Database connections not initialized',
    });
    return;
  }

  next();
}
