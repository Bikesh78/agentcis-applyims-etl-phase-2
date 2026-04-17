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

  async extractBatch(offset: number, limit: number): Promise<TempMappedDeal[]> {
    return this.dataSource
      .getRepository(TempMappedDeal)
      .createQueryBuilder('deal')
      .where('deal.migration_id = :migrationId', { migrationId: this.migrationId })
      .orderBy('deal.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return this.dataSource
      .getRepository(TempMappedDeal)
      .createQueryBuilder('deal')
      .where('deal.migration_id = :migrationId', { migrationId: this.migrationId })
      .getCount();
  }
}
