import { DataSource, Repository } from 'typeorm';
import { logger, Logger } from 'utils/logger.js';
import { MigrationCheckpoint } from 'entities/etlDb/migration-checkpoints.entity.js';

export interface ExtractorConfig {
  batchSize: number;
  startDate: Date;
  endDate: Date;
  checkpointId?: string;
}

export abstract class BaseExtractor<T> {
  protected readonly dataSource: DataSource;
  protected readonly logger: Logger;
  protected readonly config: ExtractorConfig;
  protected readonly entityType: string;
  private checkPointRepo: Repository<MigrationCheckpoint>;

  constructor(
    dataSource: DataSource,
    entityType: string,
    config: ExtractorConfig,
    loggerInstance?: Logger
  ) {
    this.dataSource = dataSource;
    this.entityType = entityType;
    this.config = config;
    this.logger = loggerInstance ?? logger;
    this.checkPointRepo = this.dataSource.getRepository(MigrationCheckpoint);
  }

  abstract extractBatch(offset: number, limit: number): Promise<T[]>;
  abstract getTotalCount(): Promise<number>;

  async *extractAll(): AsyncGenerator<T[], void, unknown> {
    const total = await this.getTotalCount();
    const batchSize = this.config.batchSize;
    const resumeOffset = await this.getResumeOffset();

    this.logger.info(`Starting extraction for ${this.entityType}`, {
      total,
      batchSize,
      resumeOffset,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
    });

    for (let offset = resumeOffset; offset < total; offset += batchSize) {
      this.logger.info(`Extracting batch: ${offset}-${Math.min(offset + batchSize, total)}`);
      const batch = await this.extractBatch(offset, batchSize);
      yield batch;
    }

    this.logger.info(`Extraction completed for ${this.entityType}`);
  }

  private async getResumeOffset(): Promise<number> {
    if (!this.config.checkpointId) {
      return 0;
    }

    try {
      const checkpoint = await this.checkPointRepo.findOne({
        where: { migrationId: this.config.checkpointId, entityType: this.entityType },
      });

      if (checkpoint?.processedCount) {
        const resumeOffset = checkpoint.processedCount;
        this.logger.info(`Resuming from checkpoint: ${resumeOffset} processed records`, {
          checkpointId: this.config.checkpointId,
          entityType: this.entityType,
        });
        return resumeOffset;
      } else {
        this.logger.warn('Checkpoint not found or no processed count, starting from beginning', {
          checkpointId: this.config.checkpointId,
          entityType: this.entityType,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to load checkpoint, starting from beginning', {
        checkpointId: this.config.checkpointId,
        error,
      });
    }

    return 0;
  }
}
