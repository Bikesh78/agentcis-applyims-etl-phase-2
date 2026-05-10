import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';

export class OfficeVisitExtractor extends BaseExtractor<OfficeVisits> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'office-visits', config);
  }

  async extractBatch(lastProcessedId: number | null, limit: number): Promise<OfficeVisits[]> {
    const qb = this.dataSource
      .getRepository(OfficeVisits)
      .createQueryBuilder('officeVisits')
      .leftJoinAndSelect('officeVisits.officeVisitAssignees', 'officeVisitAssignees')
      .where('officeVisits.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('officeVisits.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('officeVisits.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('officeVisits.id > :lastProcessedId', { lastProcessedId });
    }

    return await qb.getMany();
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
