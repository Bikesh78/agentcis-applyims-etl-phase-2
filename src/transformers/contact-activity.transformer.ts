import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ApplyIMSContactActivity } from '../entities/applyims/contact-activity.entity.js';
import { ApplicationActivityWithRelations } from '../extractors/contact-activity.extractor.js';

export class ContactActivityTransformer extends BaseTransformer<
  ApplicationActivityWithRelations,
  ApplyIMSContactActivity
> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(
    source: ApplicationActivityWithRelations,
    id: string
  ): Promise<ApplyIMSContactActivity> {
    const clientId = source.applicationStage.application.clientId;
    const applicationId = source.applicationStage.application.id;
    const userId = await this.idResolver.resolveUserId(source.userId);
    const contactId = await this.idResolver.resolveUserId(clientId);
    const activitiesTypeId = await this.idResolver.resolveApplicationId(applicationId);
    const workflowStagesId = await this.idResolver.resolveWorkflowStagesId(
      source.applicationStage.stageId
    );
    console.log('source', source);

    if (!userId) {
      throw new Error(`Cannot resolve userId ${source.userId}`);
    }
    if (!contactId) {
      throw new Error(`Cannot resolve contactId ${clientId}`);
    }
    if (!activitiesTypeId) {
      throw new Error(`Cannot resolve activitiesTypeId for ${applicationId}`);
    }
    if (!workflowStagesId) {
      throw new Error(`Cannot resolve workflowStagesId ${source.applicationStage.stageId}`);
    }

    return {
      id,
      activitiesTypeId, // should be equal to resolved application id

      // activitiesType: source.activitiesType,
      // activitiesAction: source.activitiesAction,
      // data: source.data,
      // previousAssignedUserId: source.previousAssignedUserId,
      // assignedUserId: source.assignedUserId,
      // followerUserId: source.followerUserId,

      activitiesType: 'application',
      activitiesAction: 'updated',
      data: null,
      userId,
      contactId,
      previousAssignedUserId: userId,
      assignedUserId: userId,
      followerUserId: userId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  // private getMappedData()

  protected validate(target: ApplyIMSContactActivity): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
    if (target.contactId && !isUuid(target.contactId)) {
      throw new Error(`Invalid ContactId: ${target.contactId}`);
    }
  }
}
