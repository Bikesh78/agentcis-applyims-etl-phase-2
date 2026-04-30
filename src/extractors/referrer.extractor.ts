import { BaseExtractor, ExtractorConfig } from './base.extractor.js';
import { DataSource } from 'typeorm';
import { Referrers } from 'entities/agentcis/referrers.entity.js';

const UNMAPPED_REFERRERS = [1, 518, 591, 594, 599, 604, 606, 610, 612, 627, 641, 645];

export interface ReferrerBatch {
  id: number;
  agentType: number[];
  email: string;
  branchNames: string[];
  phone: string;
  taxNumber: string;
  country: number;
  referrerName: string;
  deletedAt: string;
}

export class ReferrerExtractor extends BaseExtractor<ReferrerBatch> {
  constructor(dataSource: DataSource, config: ExtractorConfig) {
    super(dataSource, 'Referrers', config);
  }

  async extractBatch(offset: number, limit: number): Promise<ReferrerBatch[]> {
    const result = await this.dataSource
      .getRepository(Referrers)
      .createQueryBuilder('r')
      .leftJoin('related_offices', 'ro', 'r.id = ro.officeable_id')
      .leftJoin('branches', 'b', 'b.id = ro.office_id')
      .select([
        'r.id as id',
        'r.name as referrerName',
        'r.agent_type as agentType',
        'r.email as email',
        'JSON_ARRAYAGG(b.name) as branchNames',
        'r.phone as phone',
        'r.tax_number as taxNumber',
        'r.country as country',
        'r.deleted_at as deletedAt',
      ])
      .where('r.id IN (:...ids)', { ids: [UNMAPPED_REFERRERS] })
      .groupBy('r.id')
      .offset(offset)
      .limit(limit)
      .withDeleted()
      .getRawMany();
    return result;
  }

  async getTotalCount(): Promise<number> {
    return await this.dataSource
      .getRepository(Referrers)
      .createQueryBuilder('r')
      .where('r.id IN(:ids)', { ids: [...UNMAPPED_REFERRERS] })
      .getCount();
  }
}
