import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Referrers } from 'entities/agentcis/referrers.entity.js';

export class ReferrerExtractor extends BaseExtractor<Referrers> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Referrers', config);
  }
  async extractBatch(offset: number, limit: number): Promise<Referrers[]> {
    return await this.dataSource
      .getRepository(Referrers)
      .createQueryBuilder('referrers')
      .where('referrers.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('referrers.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(Referrers)
      .createQueryBuilder('referrers')
      .where('referrers.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('referrers.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
