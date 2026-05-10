import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Attachment } from 'entities/agentcis/attachments.entity.js';

export class AttachmentExtractor extends BaseExtractor<Attachment> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'attachments', config);
  }
  async extractBatch(lastProcessedId: number | null, limit: number): Promise<Attachment[]> {
    const qb = this.dataSource
      .getRepository(Attachment)
      .createQueryBuilder('attachments')
      .where('attachments.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('attachments.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('attachments.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('attachments.id > :lastProcessedId', { lastProcessedId });
    }

    return await qb.getMany();
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
