import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';

export class OfficeVisitExtractor extends BaseExtractor<OfficeVisits> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Clients', config);
  }
  async extractBatch(offset: number, limit: number): Promise<OfficeVisits[]> {
    return await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('office_visits')
      .leftJoinAndSelect('office_visits.officeVisitAssignees', 'officeVisitAssignees')
      .where('office_visits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('office_visits.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('office_visits.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('office_visits')
      .where('office_visits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('office_visits.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
