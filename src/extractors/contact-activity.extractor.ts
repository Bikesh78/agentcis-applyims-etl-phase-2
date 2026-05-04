import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { ApplicationActivities } from 'entities/agentcis/application-activities.entity.js';

export class ContactActivityExtractor extends BaseExtractor<ApplicationActivities> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'ApplicationActivity', config);
  }

  async extractBatch(offset: number, limit: number): Promise<ApplicationActivities[]> {
    return await this.dataSource
      .getRepository(ApplicationActivities)
      .createQueryBuilder('applicationActivities')
      .where('applicationActivities.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applicationActivities.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('applicationActivities.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(ApplicationActivities)
      .createQueryBuilder('applicationActivities')
      .where('applicationActivities.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applicationActivities.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
