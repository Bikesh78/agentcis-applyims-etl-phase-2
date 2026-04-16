import Joi from 'joi';
import { Request, Response } from 'express';
import { MigrationOrchestrator } from '../../orchestrators/migration.orchestrator.js';
import { CheckpointService } from '../../services/checkpoint.service.js';
import { logger } from '../../utils/logger.js';
import { MigrationConfig } from 'configs/migration.config.js';
import { EntityUnionType } from 'repositories/mapping.repository.js';

interface MigrationRequest {
  entities: EntityUnionType[];
  dateRange: {
    start: Date;
    end: Date;
  };
  batchSize: number;
  parallelism: number;
}

export const startMigrationSchema = Joi.object<MigrationRequest>({
  entities: Joi.array().items(Joi.string()).min(1).required(),
  dateRange: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().greater(Joi.ref('start')).required(),
  }).required(),
  batchSize: Joi.number().integer().positive().default(1000),
  parallelism: Joi.number().integer().positive().default(5),
});

interface CustomRequest extends Request {
  body: MigrationRequest;
}

interface ProgressMetrics {
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: string;
}

export class MigrationController {
  constructor(
    private orchestrator: MigrationOrchestrator,
    private checkpointService: CheckpointService
  ) {}

  async startMigration(req: CustomRequest, res: Response): Promise<void> {
    try {
      const { error, value } = startMigrationSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          status: 'error',
          message: error.details[0].message,
        });
        return;
      }

      const { entities, dateRange, batchSize, parallelism } = value;
      const migrationId = crypto.randomUUID();

      const migrationConfig: MigrationConfig = {
        migrationId,
        entities,
        dateRange: {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end),
        },
        batchSize,
        parallelism,
      };

      this.orchestrator.runMigration(migrationConfig).catch((err) => {
        logger.error('Migration failed', { error: err, migrationId });
      });

      res.status(202).json({
        migrationId,
        status: 'started',
        message: 'Migration started successfully',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Start migration error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }

  async getMigrationStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const progress: Record<string, ProgressMetrics> = {};
      const entities = ['branches', 'users', 'contacts', 'applications', 'deals'];

      for (const entity of entities) {
        const checkpoint = await this.checkpointService.getCheckpoint(id, entity);
        if (checkpoint && checkpoint.totalCount > 0) {
          progress[entity] = {
            total: checkpoint.totalCount,
            processed: checkpoint.processedCount,
            success: checkpoint.successCount,
            failed: checkpoint.failedCount,
            percentage: ((checkpoint.processedCount / checkpoint.totalCount) * 100).toFixed(2),
          };
        }
      }

      res.json({
        migrationId: id,
        status: 'in_progress',
        progress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Get migration status error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }

  async pauseMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.orchestrator.pause();
      res.json({ status: 'paused', message: 'Migration paused successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Pause migration error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }

  async resumeMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.orchestrator.resume();
      res.json({ status: 'resumed', message: 'Migration resumed successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Resume migration error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }

  async cancelMigration(req: Request, res: Response): Promise<void> {
    try {
      await this.orchestrator.cancel();
      res.json({ status: 'cancelled', message: 'Migration cancelled successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Cancel migration error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }
}
