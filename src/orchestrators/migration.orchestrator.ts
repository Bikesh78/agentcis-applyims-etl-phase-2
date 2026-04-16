import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from '../extractors/base.extractor.js';
import { ContactExtractor } from '../extractors/contact.extractor.js';
import { ApplicationExtractor } from '../extractors/application.extractor.js';
import { ContactTransformer } from '../transformers/contact.transformer.js';
import { ApplicationTransformer } from '../transformers/application.transformer.js';
import { IdResolver } from '../transformers/utils/id-resolver.js';
import { FieldMapper } from '../transformers/utils/field-mappers.js';
import { BatchProcessor, ProcessResult } from '../loaders/batch-processor.js';
import { CheckpointService } from '../services/checkpoint.service.js';
import { ErrorRecoveryManager, ErrorCategory } from '../loaders/error-recovery.js';
import { ApplyIMSApiClient, BulkResponse } from '../loaders/api-client.js';
import { Logger } from '../utils/logger.js';
import { MigrationJob, MigrationStatus } from '../entities/etlDb/migration-jobs.entity.js';
import { MigrationConfig } from '../configs/migration.config.js';
import { EntityType, SUPPORTED_ENTITIES } from '../constants/entity-types.js';
import { Clients } from '../entities/agentcis/clients.entity.js';
import { Applications } from '../entities/agentcis/applications.entity.js';
import { ApplyIMSContact } from '../entities/applyims/contact.entity.js';
import { ApplyIMSApplication } from '../entities/applyims/application.entity.js';
import { ApplyIMSDeal } from '../entities/applyims/deal.entity.js';
import { EntityUnionType } from 'repositories/mapping.repository.js';

export interface EntityMigrationResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
}

export interface MigrationResult {
  migrationId: string;
  status: 'completed' | 'failed' | 'partial' | 'cancelled';
  duration: number;
  entities: Record<string, EntityMigrationResult>;
}

type SourceEntity = Clients | Applications;
type TargetEntity = ApplyIMSContact | ApplyIMSApplication | ApplyIMSDeal;

interface EntityHandlers {
  extractor: BaseExtractor<SourceEntity>;
  transformer: { transform: (item: SourceEntity) => Promise<TargetEntity> };
  apiMethod: (batch: TargetEntity[]) => Promise<BulkResponse>;
}

export class MigrationOrchestrator {
  private isPaused = false;
  private isCancelled = false;
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;
  private pauseReject: ((reason?: unknown) => void) | null = null;

  constructor(
    private agentcisDb: DataSource,
    private etlDb: DataSource,
    private apiClient: ApplyIMSApiClient,
    private batchProcessor: BatchProcessor,
    private checkpointService: CheckpointService,
    private errorRecoveryManager: ErrorRecoveryManager,
    private logger: Logger
  ) {}

  async runMigration(config: MigrationConfig): Promise<MigrationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting migration ${config.migrationId}`);

    await this.createMigrationJob(config);

    const results: Record<string, EntityMigrationResult> = {};

    try {
      for (const entityType of config.entities) {
        if (!SUPPORTED_ENTITIES.includes(entityType as EntityType)) {
          this.logger.warn(`Skipping unsupported entity: ${entityType}`);
          continue;
        }

        if (this.isCancelled) {
          this.logger.warn('Migration cancelled');
          break;
        }

        if (this.isPaused) {
          this.logger.info('Migration paused, waiting...');
          await this.createPausePromise();
        }

        const result = await this.migrateEntity(config, entityType);
        this.logger.info(
          `Completed migration for ${entityType}: ${result.successful}/${result.total} successful`
        );
        results[entityType] = result;
      }

      await this.updateMigrationJob(config.migrationId, MigrationStatus.COMPLETED);
      this.logger.info(`Migration ${config.migrationId} completed`);

      return {
        migrationId: config.migrationId,
        status: Object.values(results).some((r) => r.failed > 0) ? 'partial' : 'completed',
        duration: Date.now() - startTime,
        entities: results,
      };
    } catch (error) {
      this.logger.error(`Migration ${config.migrationId} failed`, { error: String(error) });
      await this.updateMigrationJob(
        config.migrationId,
        MigrationStatus.FAILED,
        (error as Error).message
      );
      throw error;
    }
  }

  private createPausePromise(): Promise<void> {
    if (!this.pausePromise) {
      this.pausePromise = new Promise((resolve, reject) => {
        this.pauseResolve = resolve;
        this.pauseReject = reject;
      });
    }
    return this.pausePromise;
  }

  private clearPausePromise(): void {
    this.pausePromise = null;
    this.pauseResolve = null;
    this.pauseReject = null;
  }

  private async migrateEntity(
    config: MigrationConfig,
    entityType: EntityUnionType
  ): Promise<EntityMigrationResult> {
    this.logger.info(`Migrating ${entityType}`);

    const extractorConfig: ExtractorConfig = {
      batchSize: config.batchSize,
      startDate: config.dateRange.start,
      endDate: config.dateRange.end,
      checkpointId: config.resumeFrom?.checkpointId,
    };

    const handlers = this.getEntityHandlers(entityType, extractorConfig);

    const totalCount = await handlers.extractor.getTotalCount();
    this.logger.info(`Total ${entityType} count: ${totalCount}`);

    await this.checkpointService.createCheckpoint({
      migrationId: config.migrationId,
      entityType,
      totalCount,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: new Date(),
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for await (const batch of handlers.extractor.extractAll()) {
      if (this.isCancelled) break;

      if (this.isPaused) {
        await this.createPausePromise();
      }

      const transformed: TargetEntity[] = [];
      const transformResults = await Promise.allSettled(
        batch.map((item) => handlers.transformer.transform(item))
      );

      for (let i = 0; i < transformResults.length; i++) {
        const result = transformResults[i];
        if (result.status === 'fulfilled') {
          transformed.push(result.value);
        } else {
          const error =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          this.logger.error(`Transform error for ${entityType} item`, { error: String(error) });
          await this.errorRecoveryManager.logError(
            config.migrationId,
            entityType,
            String(batch[i]?.id ?? 'unknown'),
            error,
            ErrorCategory.TRANSFORMATION_ERROR,
            { payload: batch[i] }
          );
          skippedCount++;
        }
      }

      if (transformed.length === 0) {
        processedCount += batch.length;
        this.logger.warn(`All transforms failed for ${entityType} batch, skipping batch`);
        continue;
      }

      if (transformed.length < batch.length) {
        processedCount += batch.length;
      } else {
        processedCount += transformed.length;
      }

      const result: ProcessResult = await this.batchProcessor.processBatch(
        transformed as ApplyIMSContact[],
        entityType,
        handlers.apiMethod as (batch: ApplyIMSContact[]) => Promise<BulkResponse>,
        config.migrationId
      );

      successCount += result.successful;
      failedCount += result.failed;
      skippedCount += result.skipped;

      await this.checkpointService.updateCheckpoint(config.migrationId, entityType, {
        processedCount,
        successCount,
        failedCount,
        lastProcessedId: String(batch[batch.length - 1]?.id),
      });

      const percentage = ((processedCount / totalCount) * 100).toFixed(2);
      this.logger.info(
        `Progress: ${entityType} - ${processedCount}/${totalCount} (${percentage}%)`
      );
    }

    return {
      total: totalCount,
      successful: successCount,
      failed: failedCount,
      skipped: skippedCount,
    };
  }

  private getEntityHandlers(entityType: string, config: ExtractorConfig): EntityHandlers {
    switch (entityType) {
      case EntityType.CONTACTS: {
        const extractor = new ContactExtractor(this.agentcisDb, config);
        const transformer = new ContactTransformer(
          this.createIdResolver(),
          this.createFieldMapper()
        );
        return {
          extractor: extractor as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) => transformer.transform(item as Clients) as Promise<TargetEntity>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateContacts(batch as ApplyIMSContact[]),
        };
      }
      case EntityType.APPLICATIONS: {
        const extractor = new ApplicationExtractor(this.agentcisDb, config);
        const transformer = new ApplicationTransformer(this.createIdResolver());
        return {
          extractor: extractor as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as Applications) as Promise<TargetEntity>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateApplications(batch as ApplyIMSApplication[]),
        };
      }
      case EntityType.DEALS:
        throw new Error('Deal entity handler not yet implemented');
      default:
        throw new Error(`No handler for entity: ${entityType}`);
    }
  }

  private createIdResolver(): IdResolver {
    return IdResolver.createPhaseResolver(this.etlDb, this.logger);
  }

  private createFieldMapper(): FieldMapper {
    return new FieldMapper();
  }

  private async createMigrationJob(config: MigrationConfig): Promise<void> {
    const jobRepo = this.etlDb.getRepository(MigrationJob);
    const job = jobRepo.create({
      id: config.migrationId,
      status: MigrationStatus.IN_PROGRESS,
      config: {
        entities: config.entities,
        dateRange: {
          start: config.dateRange.start.toISOString(),
          end: config.dateRange.end.toISOString(),
        },
        batchSize: config.batchSize,
        parallelism: config.parallelism,
      },
      startedAt: new Date(),
    });
    await jobRepo.save(job);
    this.logger.info(`Migration job created: ${config.migrationId}`);
  }

  private async updateMigrationJob(
    migrationId: string,
    status: MigrationStatus,
    errorMessage?: string
  ): Promise<void> {
    const jobRepo = this.etlDb.getRepository(MigrationJob);
    const job = await jobRepo.findOne({ where: { id: migrationId } });
    if (job) {
      job.status = status;
      job.completedAt = new Date();
      if (errorMessage) {
        job.errorMessage = errorMessage;
      }
      await jobRepo.save(job);
    }
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    this.logger.info('Migration paused');
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.clearPausePromise();
    }
    this.logger.info('Migration resumed');
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    this.isPaused = false;
    if (this.pauseReject) {
      this.pauseReject(new Error('Migration cancelled'));
      this.clearPausePromise();
    }
    this.logger.info('Migration cancelled');
  }
}
