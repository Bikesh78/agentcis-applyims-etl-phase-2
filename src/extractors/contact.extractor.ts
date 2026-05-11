import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Clients } from 'entities/agentcis/clients.entity.js';

export class ContactExtractor extends BaseExtractor<Clients> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'contacts', config);
  }
  async extractBatch(lastProcessedId: number | null, limit: number): Promise<Clients[]> {
    const qb = this.dataSource
      .getRepository(Clients)
      .createQueryBuilder('clients')
      .leftJoinAndSelect('clients.followers', 'followers')
      .where('clients.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('clients.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('clients.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('clients.id > :lastProcessedId', { lastProcessedId });
    }

    return await qb.getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(Clients)
      .createQueryBuilder('clients')
      .where('clients.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('clients.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
