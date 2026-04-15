import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Attachment } from 'entities/agentcis/attachments.entity.js';

export class AttachmentExtractor extends BaseExtractor<Attachment> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Attachment', config);
  }
  async extractBatch(offset: number, limit: number): Promise<Attachment[]> {
    return await this.dataSource
      .getRepository(Attachment)
      .createQueryBuilder('attachments')
      .where('attachments.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('attachments.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('id')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(Attachment)
      .createQueryBuilder('attachments')
      .where('attachments.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('attachments.created_at <= :endDate', { endDate: this.config.endDate })
      .getCount();
  }
}
