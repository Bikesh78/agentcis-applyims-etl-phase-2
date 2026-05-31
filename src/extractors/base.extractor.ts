import { DataSource } from 'typeorm';
import { logger, Logger } from 'utils/logger.js';

export interface ExtractorConfig {
  batchSize: number;
  startDate: Date;
  endDate: Date;
  checkpointId?: string;
  lastProcessedId?: number | null;
  targetIds?: number[];
}

export abstract class BaseExtractor<T extends { id: number | string }> {
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

  abstract extractBatch(lastProcessedId: number | null, limit: number): Promise<T[]>;
  abstract getTotalCount(): Promise<number>;

  async extractByIds(_ids: number[]): Promise<T[]> {
    throw new Error(`extractByIds not implemented for ${this.entityType}`);
  }

  async *extractAll(): AsyncGenerator<T[], void, unknown> {
    const { batchSize } = this.config;

    if (this.config.targetIds?.length) {
      const { targetIds } = this.config;
      this.logger.info(`Starting targeted extraction for ${this.entityType}`, {
        count: targetIds.length,
        batchSize,
      });
      for (let i = 0; i < targetIds.length; i += batchSize) {
        const batch = await this.extractByIds(targetIds.slice(i, i + batchSize));
        if (batch.length > 0) yield batch;
      }
      this.logger.info(`Targeted extraction completed for ${this.entityType}`);
      return;
    }

    const total = await this.getTotalCount();
    const resumeId = this.getResumeId();

    this.logger.info(`Starting extraction for ${this.entityType}`, {
      total,
      batchSize,
      resumeId,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
    });

    let lastProcessedId: number | null = resumeId;
    let hasMore = true;
    let batchNumber = 0;

    while (hasMore) {
      this.logger.info(
        `Extracting batch ${batchNumber + 1}: ${lastProcessedId ? `after id ${lastProcessedId}` : 'from beginning'}`
      );
      const batch = await this.extractBatch(lastProcessedId, batchSize);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        const lastId = batch[batch.length - 1].id;
        lastProcessedId = typeof lastId === 'number' ? lastId : parseInt(String(lastId), 10);
        batchNumber++;
        yield batch;

        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    }

    this.logger.info(`Extraction completed for ${this.entityType}`);
  }

  private getResumeId(): number | null {
    if (this.config.lastProcessedId !== undefined && this.config.lastProcessedId !== null) {
      this.logger.info(
        `Resuming from checkpoint: lastProcessedId = ${this.config.lastProcessedId}`,
        {
          checkpointId: this.config.checkpointId,
          entityType: this.entityType,
          lastProcessedId: this.config.lastProcessedId,
        }
      );
      return this.config.lastProcessedId;
    }

    this.logger.warn('No lastProcessedId provided in config, starting from beginning', {
      checkpointId: this.config.checkpointId,
      entityType: this.entityType,
    });

    return null;
  }
}
