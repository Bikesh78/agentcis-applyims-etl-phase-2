import { ApplyIMSDeal } from 'entities/applyims/deal.entity.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';

const interestedServiceMap: Record<string, string> = {
  'e09ac3a5-78c4-4705-be23-53fe9a4c64bc': 'Migration',
  'a6cd87fa-b5f0-4a66-b1fd-a6d907a47887': 'Education',
  '5c9744e5-1908-47ce-a18c-bc1adf49c49e': 'Insurance',
  '7d5249d8-992b-4d43-9ae5-7c6ef2281314': 'Test Prep/Booking',
};

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
        typeOfService: interestedServiceMap[mappedDeal.serviceId] ?? '',
        services: [],
      },
      enquiryId: null,
      createdAt: mappedDeal.minimumDate as Date,
      updatedAt: mappedDeal.maxDate as Date,
    };
  }
}
