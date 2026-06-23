import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { ApplyIMSAgentPartner } from 'entities/applyims/agent.entity.js';
import { ReferrerBatch } from 'extractors/referrer.extractor.js';
import { COUNTRIES_MAPS } from 'constants/country-map.js';
import { FieldMapper } from './utils/field-mappers.js';

export class AgentTransformer extends BaseTransformer<ReferrerBatch, ApplyIMSAgentPartner> {
  constructor(
    idResolver: IdResolver,
    private fieldMapper: FieldMapper
  ) {
    super(idResolver);
  }

  protected getSourceId(source: ReferrerBatch): string {
    return `agent:${source.id}`;
  }

  protected async transformImpl(source: ReferrerBatch): Promise<ApplyIMSAgentPartner | null> {
    const result: ApplyIMSAgentPartner = {
      agentcisId: source.id,
      name: this.fieldMapper.cleanName(source.referrerName)!,
      isSubAgent: this.isSubAgent(source.agentType),
      isSuperAgent: this.isSuperAgent(source.agentType),
      deactivated: Boolean(source.deletedAt),
      taxNumber: source.taxNumber,
      branches: [
        {
          name: source.branchNames.join(', '),
          email: this.fieldMapper.cleanEmail(source.email)!,
          phone: source.phone || null,
          isMainBranch: true,
          countryCode: this.getCountryCode(source.country),
        },
      ],
    };
    return result;
  }

  protected validate(): void {}

  private getCountryCode(country: number) {
    if (COUNTRIES_MAPS[country] === 'Australia') {
      return '+61';
    } else if (COUNTRIES_MAPS[country] === 'Nepal') {
      return '+977';
    }
    return null;
  }

  private isSubAgent(agentType: number[] | null): boolean {
    if (!agentType) return false;
    return agentType.includes(2);
  }

  private isSuperAgent(agentType: number[] | null): boolean {
    if (!agentType) return false;
    return agentType.includes(1);
  }
}
