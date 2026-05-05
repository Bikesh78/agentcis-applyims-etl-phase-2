import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { ApplicationActivities } from 'entities/agentcis/application-activities.entity.js';

export interface ApplicationActivityWithRelations extends Omit<
  ApplicationActivities,
  'applicationStage'
> {
  applicationStage: {
    id: number;
    stageId: number;
    application: {
      id: number;
      clientId: number;
    };
  };
}

export class ContactActivityExtractor extends BaseExtractor<ApplicationActivityWithRelations> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'ApplicationActivity', config);
  }

  async extractBatch(offset: number, limit: number): Promise<ApplicationActivityWithRelations[]> {
    const results = await this.dataSource
      .getRepository(ApplicationActivities)
      .createQueryBuilder('applicationActivities')
      .leftJoinAndSelect('applicationActivities.applicationStage', 'applicationStage')
      .leftJoinAndSelect('applicationStage.application', 'application')
      .select([
        'applicationActivities',
        'applicationStage.id',
        'applicationStage.stageId',
        'application.clientId',
        'application.id',
      ])
      .where('applicationActivities.created_at >= :startDate', { startDate: this.config.startDate })
      .andWhere('applicationActivities.created_at <= :endDate', { endDate: this.config.endDate })
      .orderBy('applicationActivities.id')
      .offset(offset)
      .limit(limit)
      .getMany();

    return results as unknown as ApplicationActivityWithRelations[];
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
