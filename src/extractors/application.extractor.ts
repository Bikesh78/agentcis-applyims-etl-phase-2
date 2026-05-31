import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Applications } from 'entities/agentcis/applications.entity.js';

export class ApplicationExtractor extends BaseExtractor<Applications> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'applications', config);
  }
  async extractBatch(lastProcessedId: number | null, limit: number): Promise<Applications[]> {
    const qb = this.dataSource
      .getRepository(Applications)
      .createQueryBuilder('applications')
      .leftJoinAndSelect('applications.products', 'products')
      .leftJoinAndSelect('applications.referrers', 'referrers')
      .leftJoinAndSelect('applications.groupProductFees', 'groupProductFees.application')
      .leftJoinAndSelect('applications.applicationAssignees', 'applicationAssignees')
      .where('applications.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applications.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('applications.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('applications.id > :lastProcessedId', { lastProcessedId });
    }

    return await qb.getMany();
  }

  async extractByIds(ids: number[]): Promise<Applications[]> {
    return this.dataSource
      .getRepository(Applications)
      .createQueryBuilder('applications')
      .leftJoinAndSelect('applications.products', 'products')
      .leftJoinAndSelect('applications.referrers', 'referrers')
      .leftJoinAndSelect('applications.groupProductFees', 'groupProductFees.application')
      .leftJoinAndSelect('applications.applicationAssignees', 'applicationAssignees')
      .where('applications.id IN (:...ids)', { ids })
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
