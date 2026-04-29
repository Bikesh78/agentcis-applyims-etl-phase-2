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
    if (!mappedDeal.serviceId) {
      throw new Error(`Missing serviceId for deal ${mappedDeal.dealId}`);
    }

    return {
      id: mappedDeal.dealId,
      name: mappedDeal.dealName ?? '',
      branchId: mappedDeal.branchId,
      interestedServiceId: mappedDeal.serviceId,
      assignees: mappedDeal?.userId ? [{ id: mappedDeal.userId }] : [],
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
