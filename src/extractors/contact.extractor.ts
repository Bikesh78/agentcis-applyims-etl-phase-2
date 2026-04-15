import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Clients } from 'entities/agentcis/clients.entity.js';

export class ContactExtractor extends BaseExtractor<Clients> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Clients', config);
  }
  async extractBatch(offset: number, limit: number): Promise<Clients[]> {
    console.log('contact extract', offset);
    return await this.dataSource
      .getRepository(Clients)
      .createQueryBuilder('clients')
      .where('clients.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('clients.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('id')
      .offset(offset)
      .limit(limit)
      .getMany();
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
