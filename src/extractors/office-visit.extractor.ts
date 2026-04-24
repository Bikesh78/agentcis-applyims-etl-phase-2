import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';

export class OfficeVisitExtractor extends BaseExtractor<OfficeVisits> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'OfficeVisits', config);
  }

  async extractBatch(offset: number, limit: number): Promise<OfficeVisits[]> {
    return await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .leftJoinAndSelect('officeVisits.officeVisitAssignees', 'officeVisitAssignees')
      .where('officeVisits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('officeVisits.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('officeVisits.id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .where('officeVisits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('officeVisits.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
