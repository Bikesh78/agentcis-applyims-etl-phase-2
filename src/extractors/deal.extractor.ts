import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';
import { Logger } from 'utils/logger.js';

export class DealExtractor extends BaseExtractor<TempMappedDeal> {
  private migrationId: string;

  constructor(
    dataSource: DataSource,
    migrationId: string,
    config: ExtractorConfig,
    loggerInstance?: Logger
  ) {
    super(dataSource, 'deals', config, loggerInstance);
    this.migrationId = migrationId;
  }

  async extractBatch(lastProcessedId: number | null, limit: number): Promise<TempMappedDeal[]> {
    const qb = this.dataSource
      .getRepository(TempMappedDeal)
      .createQueryBuilder('deal')
      .where('deal.migration_id = :migrationId', { migrationId: this.migrationId })
      .orderBy('deal.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('deal.id > :lastProcessedId', { lastProcessedId });
    }

    return qb.getMany();
  }

  async getTotalCount(): Promise<number> {
    return this.dataSource
      .getRepository(TempMappedDeal)
      .createQueryBuilder('deal')
      .where('deal.migration_id = :migrationId', { migrationId: this.migrationId })
      .getCount();
  }
}
