import { Router, Request, Response, NextFunction } from 'express';
import { getDatabaseConnection } from 'configs/database.config.js';
import { MonitoringService } from '../../services/monitoring.service.js';
import { MonitoringController } from '../controllers/monitoring.controller.js';
import { dbCheckMiddleware } from '../middleware/db-check.middleware.js';
import { Services } from '../../types/express.extensions.js';

let services: {
  monitoringService: MonitoringService;
  monitoringController: MonitoringController;
} | null = null;

function getServices() {
  if (services) {
    return services;
  }

  const dbConnections = getDatabaseConnection();

  if (!dbConnections?.etlDb) {
    throw new Error('ETL database not initialized');
  }

  const monitoringService = new MonitoringService(dbConnections.etlDb);
  const monitoringController = new MonitoringController(monitoringService);

  services = { monitoringService, monitoringController };
  return services;
}

function servicesMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { monitoringService, monitoringController } = getServices();
  req.services = { monitoringService, monitoringController } as unknown as Services;
  next();
}

const router = Router();

router.use(dbCheckMiddleware);
router.use(servicesMiddleware);

router.get('/dashboard', (req: Request, res: Response) => {
  const { monitoringController } = req.services as unknown as {
    monitoringController: MonitoringController;
  };
  monitoringController.getDashboard(req, res);
});

export default router;
