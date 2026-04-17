import { ApplyIMSDeal } from 'entities/applyims/deal.entity.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';

export class DealTransformer {
  async transform(mappedDeal: TempMappedDeal): Promise<ApplyIMSDeal> {
    if (!mappedDeal.contactId) {
      throw new Error(`Missing contactId for deal ${mappedDeal.dealId}`);
    }
    if (!mappedDeal.branchId) {
      throw new Error(`Missing branchId for deal ${mappedDeal.dealId}`);
    }

    return {
      id: mappedDeal.dealId,
      name: mappedDeal.dealName ?? '',
      branchId: mappedDeal.branchId,
      // TODO: Map interestedServiceId from AgentCIS data when available
      interestedServiceId: 'e09ac3a5-78c4-4705-be23-53fe9a4c64bc',
      assignees: [],
      contactId: mappedDeal.contactId,
      status: 'in-progress',
      payload: {
        countries: [],
        typeOfService: '',
        services: [],
      },
      enquiryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
