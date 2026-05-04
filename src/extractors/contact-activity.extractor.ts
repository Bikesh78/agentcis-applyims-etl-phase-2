import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { ContactActivities } from 'entities/agentcis/contact-activities.entity.js';

export class ContactActivityExtractor extends BaseExtractor<ContactActivities> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'ContactActivity', config);
  }

  async extractBatch(offset: number, limit: number): Promise<ContactActivities[]> {
    return await this.dataSource
      .getRepository(ContactActivities)
      .createQueryBuilder('contactActivities')
      .where('contactActivities.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('contactActivities.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('contactActivities.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(ContactActivities)
      .createQueryBuilder('contactActivities')
      .where('contactActivities.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('contactActivities.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
