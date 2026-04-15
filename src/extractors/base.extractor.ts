import { DataSource } from 'typeorm';
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
  }

  abstract extractBatch(offset: number, limit: number): Promise<T[]>;
  abstract getTotalCount(): Promise<number>;

  async *extractAll(): AsyncGenerator<T[], void, unknown> {
    // const total = await this.getTotalCount();
    const total = 100;
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
      const checkpointIdNum = parseInt(this.config.checkpointId, 10);
      if (isNaN(checkpointIdNum)) {
        this.logger.warn('Invalid checkpointId, starting from beginning', {
          checkpointId: this.config.checkpointId,
        });
        return 0;
      }

      const checkpoint = await this.dataSource.getRepository(MigrationCheckpoint).findOne({
        where: { id: checkpointIdNum },
      });

      if (checkpoint?.processedCount) {
        const resumeOffset = checkpoint.processedCount;
        this.logger.info(`Resuming from checkpoint: ${resumeOffset} processed records`, {
          checkpointId: this.config.checkpointId,
        });
        return resumeOffset;
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
