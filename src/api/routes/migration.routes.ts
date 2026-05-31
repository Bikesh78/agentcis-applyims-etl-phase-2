import { Router, Request, Response, NextFunction } from 'express';
import { getDatabaseConnection } from 'configs/database.config.js';
import { MigrationOrchestrator } from '../../orchestrators/migration.orchestrator.js';
import { CheckpointService } from '../../services/checkpoint.service.js';
import { ApplyIMSApiClient } from '../../loaders/api-client.js';
import { BatchProcessor } from '../../loaders/batch-processor.js';
import { ErrorRecoveryManager } from '../../loaders/error-recovery.js';
import { MappingRepository } from '../../repositories/mapping.repository.js';
import { logger } from '../../utils/logger.js';
import { MigrationController } from '../controllers/migration.controller.js';
import { getConfig } from '../../configs/index.js';
import { dbCheckMiddleware } from '../middleware/db-check.middleware.js';
import { Services } from '../../types/express.extensions.js';
import { S3CopyService } from '../../services/s3-copy.service.js';

let services: Services | null = null;

function getServices(): Services {
  if (services) {
    return services;
  }

  const dbConnections = getDatabaseConnection();

  if (!dbConnections?.agentcisDb || !dbConnections?.etlDb) {
    throw new Error('Database connections not initialized');
  }

  const config = getConfig();

  const apiClient = new ApplyIMSApiClient(config.applyimsApi, logger);
  const mappingRepository = new MappingRepository(dbConnections.etlDb);
  const errorRecoveryManager = new ErrorRecoveryManager(dbConnections.etlDb, logger);
  const checkpointService = new CheckpointService(dbConnections.etlDb, logger);
  const s3CopyService = new S3CopyService(config.s3Bucket.awsRegion, logger);

  const batchProcessor = new BatchProcessor(
    apiClient,
    mappingRepository,
    errorRecoveryManager,
    logger,
    500
  );

  const orchestrator = new MigrationOrchestrator(
    dbConnections.agentcisDb,
    dbConnections.etlDb,
    apiClient,
    batchProcessor,
    checkpointService,
    errorRecoveryManager,
    mappingRepository,
    s3CopyService,
    config.s3Bucket,
    config.tenant,
    logger
  );

  services = { orchestrator, checkpointService };
  return services;
}

function servicesMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { orchestrator, checkpointService } = getServices();
  req.services = { orchestrator, checkpointService };
  next();
}

const router = Router();

router.use(dbCheckMiddleware);
router.use(servicesMiddleware);

router.post('/start', (req: Request, res: Response) => {
  const { orchestrator, checkpointService } = req.services!;
  const controller = new MigrationController(orchestrator, checkpointService);
  controller.startMigration(req, res);
});

router.get('/incomplete', (req: Request, res: Response) => {
  const { checkpointService } = req.services!;
  const controller = new MigrationController(null, checkpointService);
  controller.listIncompleteMigrations(req, res);
});

router.get('/:id/status', (req: Request, res: Response) => {
  const { orchestrator, checkpointService } = req.services!;
  const controller = new MigrationController(orchestrator, checkpointService);
  controller.getMigrationStatus(req, res);
});

router.post('/:id/resume', (req: Request, res: Response) => {
  const { orchestrator, checkpointService } = req.services!;
  const controller = new MigrationController(orchestrator, checkpointService);
  controller.resumeMigration(req, res);
});

router.post('/:id/retry', (req: Request, res: Response) => {
  const { orchestrator, checkpointService } = req.services!;
  const controller = new MigrationController(orchestrator, checkpointService);
  controller.retryMigration(req, res);
});

router.post('/:id/cancel', (req: Request, res: Response) => {
  const { orchestrator, checkpointService } = req.services!;
  const controller = new MigrationController(orchestrator, checkpointService);
  controller.cancelMigration(req, res);
});

export default router;
