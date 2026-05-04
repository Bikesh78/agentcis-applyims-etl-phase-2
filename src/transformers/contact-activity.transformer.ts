import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ContactActivities } from '../entities/agentcis/contact-activities.entity.js';
import { ApplyIMSContactActivity } from '../entities/applyims/contact-activity.entity.js';

export class ContactActivityTransformer extends BaseTransformer<
  ContactActivities,
  ApplyIMSContactActivity
> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(
    source: ContactActivities,
    id: string
  ): Promise<ApplyIMSContactActivity> {
    return {
      id,
      activitiesTypeId: source.activitiesTypeId,
      activitiesType: source.activitiesType,
      activitiesAction: source.activitiesAction,
      data: source.data,
      userId: source.userId,
      contactId: source.contactId,
      updateType: source.updateType,
      previousAssignedUserId: source.previousAssignedUserId,
      assignedUserId: source.assignedUserId,
      followerUserId: source.followerUserId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  protected validate(target: ApplyIMSContactActivity): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
    if (target.contactId && !isUuid(target.contactId)) {
      throw new Error(`Invalid ContactId: ${target.contactId}`);
    }
  }
}
