import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Applications } from 'entities/agentcis/applications.entity.js';

export class ApplicationExtractor extends BaseExtractor<Applications> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Applications', config);
  }
  async extractBatch(offset: number, limit: number): Promise<Applications[]> {
    return await this.dataSource
      .getRepository(Applications)
      .createQueryBuilder('applications')
      .leftJoinAndSelect('applications.products', 'products')
      .leftJoinAndSelect('applications.referrers', 'referrers')
      .leftJoinAndSelect('applications.groupProductFees', 'groupProductFees.application')
      .leftJoinAndSelect('applications.applicationAssignees', 'applicationAssignees')
      .where('applications.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applications.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('applications.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(Applications)
      .createQueryBuilder('applications')
      .where('applications.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applications.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
