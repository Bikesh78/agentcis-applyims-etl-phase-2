import Joi from 'joi';
import { Request, Response } from 'express';
import { MigrationOrchestrator } from '../../orchestrators/migration.orchestrator.js';
import { CheckpointService } from '../../services/checkpoint.service.js';
import { logger } from '../../utils/logger.js';
import { MigrationConfig } from 'configs/migration.config.js';
import { EntityType, SUPPORTED_ENTITIES } from '../../constants/entity-types.js';

interface MigrationRequest {
  entities: EntityType[];
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
  batchSize: Joi.number().integer().positive().default(500),
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
    private orchestrator: MigrationOrchestrator | null,
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

      this.orchestrator!.runMigration(migrationConfig).catch((err) => {
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
      const entities = ['branches', 'users', 'contacts', 'applications', 'deals', 'office-visits'];

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

  async resumeMigration(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const overrideConfig = req.body ?? {};

      const originalJob = await this.checkpointService.getMigrationJob(id);
      if (!originalJob) {
        res.status(404).json({
          status: 'error',
          message: `Migration job not found: ${id}`,
        });
        return;
      }

      const originalConfig = originalJob.config as MigrationConfig | undefined;
      const checkpoints = await this.checkpointService.getAllCheckpoints(id);

      const requestedEntities = (overrideConfig.entities ??
        originalConfig?.entities ??
        []) as EntityType[];

      const entities = requestedEntities.filter((entity) => {
        const checkpoint = checkpoints.find((cp) => cp.entityType === entity);
        return !checkpoint?.completedAt;
      });

      if (entities.length === 0) {
        const completedEntities = requestedEntities.map((e) => {
          const cp = checkpoints.find((c) => c.entityType === e);
          return `${e} (completed: ${cp?.completedAt ? 'yes' : 'no'})`;
        });
        res.json({
          status: 'completed',
          message: 'All entities already completed',
          migrationId: id,
          entities: completedEntities,
        });
        return;
      }

      const mergedConfig: MigrationConfig = {
        migrationId: id,
        entities,
        dateRange: {
          start: overrideConfig.dateRange?.start
            ? new Date(overrideConfig.dateRange.start)
            : originalConfig?.dateRange?.start
              ? new Date(originalConfig.dateRange.start)
              : new Date(),
          end: overrideConfig.dateRange?.end
            ? new Date(overrideConfig.dateRange.end)
            : originalConfig?.dateRange?.end
              ? new Date(originalConfig.dateRange.end)
              : new Date(),
        },
        batchSize: overrideConfig.batchSize ?? originalConfig?.batchSize ?? 100,
        parallelism: overrideConfig.parallelism ?? originalConfig?.parallelism ?? 5,
        resumeFrom: {
          checkpointId: id,
        },
      };

      const entityCheckpoints = checkpoints.filter((cp) =>
        entities.includes(cp.entityType as EntityType)
      );
      const existingProgress = entityCheckpoints.reduce((sum, cp) => sum + cp.processedCount, 0);
      const totalCount = entityCheckpoints.reduce((sum, cp) => sum + cp.totalCount, 0);

      if (existingProgress >= totalCount && totalCount > 0) {
        res.json({
          status: 'completed',
          message: 'All remaining entities already completed',
          migrationId: id,
          progress: {
            processed: existingProgress,
            total: totalCount,
          },
        });
        return;
      }

      this.orchestrator!.runMigration(mergedConfig).catch((err) => {
        logger.error('Resume migration failed', { error: err, migrationId: id });
      });

      res.json({
        status: 'resumed',
        migrationId: id,
        message: `Migration resumed for ${entities.length} incomplete entity(s): ${entities.join(', ')}`,
        progress: {
          processed: existingProgress,
          total: totalCount,
        },
      });
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
      await this.orchestrator!.cancel();
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

  async retryMigration(req: Request, res: Response): Promise<void> {
    try {
      const originalMigrationId = req.params.id as string;

      const { error, value } = Joi.object({
        entityTypes: Joi.array()
          .items(
            Joi.string()
              .valid(...SUPPORTED_ENTITIES)
              .insensitive()
          )
          .min(1)
          .required(),
      }).validate(req.body);

      if (error) {
        res.status(400).json({ status: 'error', message: error.details[0].message });
        return;
      }

      const job = await this.checkpointService.getMigrationJob(originalMigrationId);
      if (!job) {
        res.status(404).json({
          status: 'error',
          message: `Migration not found: ${originalMigrationId}`,
        });
        return;
      }

      const normalizedEntityTypes = (value.entityTypes as string[]).map((e) =>
        e.toLowerCase()
      ) as EntityType[];

      const retryMigrationId = await this.orchestrator!.retryFailedEntities(
        originalMigrationId,
        normalizedEntityTypes
      );

      res.status(202).json({
        status: 'retrying',
        retryMigrationId,
        originalMigrationId,
        entityTypes: value.entityTypes,
        message: `Retry started. Track errors via retryMigrationId.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Retry migration error', { error: message });
      res.status(500).json({ status: 'error', message });
    }
  }

  async listIncompleteMigrations(req: Request, res: Response): Promise<void> {
    try {
      const migrations = await this.checkpointService.getIncompleteMigrations();
      res.json({
        status: 'success',
        count: migrations.length,
        migrations,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('List incomplete migrations error', { error: message });
      res.status(500).json({
        status: 'error',
        message,
      });
    }
  }
}
