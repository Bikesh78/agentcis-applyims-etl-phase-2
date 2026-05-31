import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { Users } from '../entities/agentcis/users.entity.js';

const BASE_USER_MIGRATION_IDS: number[] = [
  28, 106, 129, 148, 158, 165, 184, 205, 211, 220, 227, 230, 234, 248, 291, 308, 332, 362, 363, 366,
  385, 386, 390, 415, 416, 421, 422, 424, 440, 463, 670, 728, 790, 803, 823, 917, 937, 959, 960,
  1003, 1024, 1025, 1029, 1030, 1040, 1174, 1175, 1231, 1277, 1360, 1376, 1379, 1395, 1545, 1549,
  1562, 1600, 1602, 1683, 1707,
];

// Additional users referenced by historical records (notes, office-visits, contact-activities,
// applications) that were missing from the original allowlist. Excludes test accounts and ids
// 645 and 1670.
const ADDITIONAL_USER_MIGRATION_IDS: number[] = [
  132, 140, 241, 310, 320, 341, 373, 435, 451, 465, 468, 470, 471, 477, 498, 503, 504, 516, 525,
  528, 535, 537, 542, 549, 562, 582, 586, 595, 596, 599, 609, 613, 618, 628, 632, 636, 639, 668,
  678, 686, 690, 691, 701, 713, 714, 729, 734, 745, 761, 856, 881, 891, 898, 939, 975, 1008, 1033,
  1065, 1084, 1110, 1122, 1140, 1142, 1160, 1169, 1190, 1201, 1204, 1234, 1237, 1283, 1301, 1318,
  1334, 1394, 1403, 1418, 1441, 1501, 1550, 1583, 1593, 1615, 1677, 1708, 1789, 1815, 1857,
];

export const USER_MIGRATION_IDS: number[] = [
  ...BASE_USER_MIGRATION_IDS,
  ...ADDITIONAL_USER_MIGRATION_IDS,
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

  async extractByIds(ids: number[]): Promise<Users[]> {
    return this.dataSource
      .getRepository(Users)
      .createQueryBuilder('users')
      .where('users.id IN (:...ids)', { ids })
      .getMany();
  }

  async getTotalCount(): Promise<number> {
    return this.dataSource
      .getRepository(Users)
      .createQueryBuilder('users')
      .where('users.id IN (:...ids)', { ids: USER_MIGRATION_IDS })
      .getCount();
  }
}
