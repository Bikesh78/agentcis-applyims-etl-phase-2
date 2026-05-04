import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ApplyIMSContactActivity } from '../entities/applyims/contact-activity.entity.js';
import { ApplicationActivities } from 'entities/agentcis/application-activities.entity.js';

export class ContactActivityTransformer extends BaseTransformer<
  ApplicationActivities,
  ApplyIMSContactActivity
> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(
    source: ApplicationActivities,
    id: string
  ): Promise<ApplyIMSContactActivity> {
    console.log('source', JSON.stringify(source, null, 2));
    const userId = await this.idResolver.resolveUserId(source.userId);
    // const contactId = await this.idResolver.resolveContactId(source.);
    const contactId = '82336da6-d087-447f-b67c-d3276c497a21';

    if (!userId) {
      throw new Error(`Cannot resolve userId ${source.userId}`);
    }

    return {
      id,
      activitiesTypeId: null, // should be equal to resolved application id

      // activitiesType: source.activitiesType,
      // activitiesAction: source.activitiesAction,
      // data: source.data,
      // previousAssignedUserId: source.previousAssignedUserId,
      // assignedUserId: source.assignedUserId,
      // followerUserId: source.followerUserId,
      // activitiesType: null,
      // activitiesAction: null,

      activitiesType: 'application',
      activitiesAction: 'updated',
      data: null,
      userId,
      contactId,
      // updateType: source.updateType,
      previousAssignedUserId: userId,
      assignedUserId: userId,
      followerUserId: userId,
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
