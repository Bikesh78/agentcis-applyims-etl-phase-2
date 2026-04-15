import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from '../extractors/base.extractor.js';
import { ContactExtractor } from '../extractors/contact.extractor.js';
import { ContactTransformer } from '../transformers/contact.transformer.js';
import { IdResolver } from '../transformers/utils/id-resolver.js';
import { FieldMapper } from '../transformers/utils/field-mappers.js';
import { BatchProcessor, ProcessResult } from '../loaders/batch-processor.js';
import { CheckpointService } from '../services/checkpoint.service.js';
import { ErrorRecoveryManager } from '../loaders/error-recovery.js';
import { ApplyIMSApiClient, BulkResponse } from '../loaders/api-client.js';
import { Logger } from '../utils/logger.js';
import { MigrationJob, MigrationStatus } from '../entities/etlDb/migration-jobs.entity.js';
import { MigrationConfig } from 'configs/migration.config.js';

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

export class MigrationOrchestrator {
  private isPaused = false;
  private isCancelled = false;
  private pauseResolve: (() => void) | null = null;

  constructor(
    private agentcisDb: DataSource,
    private etlDb: DataSource,
    private apiClient: ApplyIMSApiClient,
    private batchProcessor: BatchProcessor,
    private checkpointService: CheckpointService,
    private errorRecoveryManager: ErrorRecoveryManager,
    private logger: Logger
  ) { }

  async runMigration(config: MigrationConfig): Promise<MigrationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting migration ${config.migrationId}`);

    await this.createMigrationJob(config);

    const results: Record<string, EntityMigrationResult> = {};

    try {
      for (const entityType of config.entities) {
        if (this.isCancelled) {
          this.logger.warn('Migration cancelled');
          break;
        }

        while (this.isPaused) {
          this.logger.info('Migration paused, waiting...');
          await this.sleep(1000);
        }

        const result = await this.migrateEntity(config, entityType);
        console.log('result', result);
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

  private async migrateEntity(
    config: MigrationConfig,
    entityType: string
  ): Promise<EntityMigrationResult> {
    this.logger.info(`Migrating ${entityType}`);

    const extractorConfig: ExtractorConfig = {
      batchSize: config.batchSize,
      startDate: config.dateRange.start,
      endDate: config.dateRange.end,
    };

    const extractor = this.createExtractor(entityType, extractorConfig);
    const transformer = this.createTransformer(entityType);

    const totalCount = await extractor.getTotalCount();
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

    for await (const batch of extractor.extractAll()) {
      if (this.isCancelled) break;

      while (this.isPaused) {
        await this.sleep(1000);
      }

      let transformed: any[];
      try {
        transformed = await Promise.all(batch.map((item) => transformer.transform(item)));
      } catch (transformError: any) {
        this.logger.error(`Transform error for ${entityType} batch`, transformError);
        await this.errorRecoveryManager.logError(
          config.migrationId,
          entityType,
          String(batch[0]?.id ?? 'unknown'),
          transformError,
          'TRANSFORMATION_ERROR' as any,
          { batch }
        );
        skippedCount += batch.length;
        processedCount += batch.length;
        continue;
      }

      const apiMethod = this.getApiMethod(entityType);
      const result: ProcessResult = await this.batchProcessor.processBatch(
        transformed,
        entityType as any,
        apiMethod,
        config.migrationId
      );

      processedCount += batch.length;
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

  private createExtractor(entityType: string, config: ExtractorConfig): BaseExtractor<any> {
    switch (entityType) {
      case 'contacts':
        return new ContactExtractor(this.agentcisDb, config);
      default:
        throw new Error(`No extractor for entity: ${entityType}`);
    }
  }

  private createTransformer(entityType: string): any {
    switch (entityType) {
      case 'contacts':
        return new ContactTransformer(
          this.createIdResolver(),
          this.createFieldMapper(),
          this.logger
        );
      default:
        throw new Error(`No transformer for entity: ${entityType}`);
    }
  }

  private createIdResolver(): IdResolver {
    return IdResolver.createPhaseResolver(this.etlDb, this.logger);
  }

  private createFieldMapper(): FieldMapper {
    return new FieldMapper();
  }

  private getApiMethod(entityType: string): (batch: any[]) => Promise<BulkResponse> {
    switch (entityType) {
      case 'contacts':
        return this.apiClient.bulkCreateContacts.bind(this.apiClient);
      case 'applications':
        return this.apiClient.bulkCreateApplications.bind(this.apiClient);
      case 'deals':
        return this.apiClient.bulkCreateDeals.bind(this.apiClient);
      default:
        throw new Error(`No API method for entity: ${entityType}`);
    }
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
    this.logger.info('Migration resumed');
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    this.isPaused = false;
    this.logger.info('Migration cancelled');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
