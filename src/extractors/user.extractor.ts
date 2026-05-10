import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { Users } from '../entities/agentcis/users.entity.js';

export const USER_MIGRATION_IDS: number[] = [
  28, 106, 129, 148, 158, 165, 184, 205, 211, 220, 227, 230, 234, 248, 291, 308, 332, 362, 363, 366,
  385, 386, 390, 415, 416, 421, 422, 424, 440, 463, 670, 728, 790, 803, 823, 917, 937, 959, 960,
  1003, 1024, 1025, 1029, 1030, 1040, 1174, 1175, 1231, 1277, 1360, 1376, 1379, 1395, 1545, 1549,
  1562, 1600, 1602, 1683, 1707,
];

export class UserExtractor extends BaseExtractor<Users> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'users', config);
  }

  async extractBatch(lastProcessedId: number | null, limit: number): Promise<Users[]> {
    const qb = this.dataSource
      .getRepository(Users)
      .createQueryBuilder('users')
      .where('users.id IN (:...ids)', { ids: USER_MIGRATION_IDS })
      .orderBy('users.id', 'ASC')
      .take(limit);

    if (lastProcessedId !== null && lastProcessedId !== undefined) {
      qb.andWhere('users.id > :lastProcessedId', { lastProcessedId });
    }

    return qb.getMany();
  }

  async getTotalCount(): Promise<number> {
    return this.dataSource
      .getRepository(Users)
      .createQueryBuilder('users')
      .where('users.id IN (:...ids)', { ids: USER_MIGRATION_IDS })
      .getCount();
  }
}
