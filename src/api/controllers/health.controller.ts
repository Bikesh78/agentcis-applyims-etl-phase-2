import { getDatabaseConnection } from 'configs/database.config.js';
import { Request, Response } from 'express';
import { logger } from 'utils/logger.js';

export async function getHealthController(_req: Request, res: Response) {
  const dbConnections = getDatabaseConnection();
  const result = { agentcis: false, etl: false };

  if (!dbConnections) {
    logger.warn('Database connections not initialized');
    return res.status(503).json({ message: 'Database connections not initialized' });
  }

  try {
    await dbConnections.agentcisDb.query('SELECT 1');
    result.agentcis = true;
  } catch (error) {
    logger.error('AgentCIS health check failed:', { error });
  }

  try {
    await dbConnections.etlDb.query('SELECT 1');
    result.etl = true;
  } catch (error) {
    logger.error('ETL health check failed:', { error });
  }

  const isHealthy = result.agentcis && result.etl;

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'Healthy' : 'Unhealthy',
    services: {
      agentcisDb: result.agentcis ? 'Connected' : 'Not Connected',
      etlDb: result.etl ? 'Connected' : 'Not Connected',
    },
  });
}
