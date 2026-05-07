import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ApplyIMSContactActivity } from '../entities/applyims/contact-activity.entity.js';
import { ApplicationActivityWithRelations } from '../extractors/contact-activity.extractor.js';
import {
  ApplyIMSActivitiesType,
  ApplyIMSActivitiesActionType,
  AgentcisDescription,
  ApplyIMSActivitiesJsonField,
} from '../types/activities-type.js';

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
    const contactId = await this.idResolver.resolveContactId(clientId);
    const activitiesTypeId = await this.idResolver.resolveApplicationId(applicationId);
    const appIdentifier = await this.idResolver.resolveAppIdentifier(applicationId);
    const description: AgentcisDescription = source.description
      ? JSON.parse(source.description)
      : null;

    if (!userId) {
      throw new Error(`Cannot resolve userId ${source.userId}`);
    }
    if (!contactId) {
      throw new Error(`Cannot resolve contactId ${clientId}`);
    }
    if (!activitiesTypeId) {
      throw new Error(`Cannot resolve activitiesTypeId for ${applicationId}`);
    }
    if (!appIdentifier) {
      throw new Error(`Cannot resolve appIdentifier for ${applicationId}`);
    }

    const { activitiesType, activitiesAction, data } = await this.mapActivityType(
      source,
      activitiesTypeId,
      contactId,
      description,
      appIdentifier
    );

    return {
      id,
      activitiesTypeId,
      activitiesType,
      activitiesAction,
      data,
      userId,
      contactId,
      previousAssignedUserId: userId,
      assignedUserId: userId,
      followerUserId: userId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  private async mapActivityType(
    source: ApplicationActivityWithRelations,
    activitiesTypeId: string,
    contactId: string,
    description: AgentcisDescription,
    appIdentifier: string
  ): Promise<{
    activitiesType: ApplyIMSActivitiesType;
    activitiesAction: ApplyIMSActivitiesActionType;
    data: ApplyIMSActivitiesJsonField;
  }> {
    const agentcisType = source.type as string | null;
    const userName = description.user_name;
    const stageId = await this.idResolver.resolveWorkflowStagesId(source.applicationStage?.stageId);

    switch (agentcisType) {
      case 'reverted-discontinued-application': {
        return {
          activitiesType: 'application',
          activitiesAction: 'revert',
          data: {
            data: {
              activeStageId: stageId!,
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              status: 'Discontinued',
              statusRemarks: {
                discontinue: {
                  reason: 'Reverted via Migration',
                  remarks: `Action by ${userName}`,
                },
              },
            },
          },
        };
      }

      case 'reverted-completed-application': {
        return {
          activitiesType: 'application',
          activitiesAction: 'reopened',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              status: 'Completed',
              activeStageId: stageId!,
            },
          },
        };
      }

      case 'discontinued-application': {
        const reason = description?.reason;
        return {
          activitiesType: 'application',
          activitiesAction: 'discontinued',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              status: 'Discontinued',
              statusRemarks: {
                discontinue: {
                  reason: reason?.title || 'Client Lost',
                  remarks: `Action by ${userName}`,
                },
              },
            },
          },
        };
      }

      case 'application-stage-moved': {
        const stage = description?.stage;
        if (!stage) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        const oldId = stage.old.id;
        const newId = stage.new.id;
        const oldNext = stage.old.next;
        const oldPrevious = stage.old.previous;

        let action: ApplyIMSActivitiesActionType = 'updated';
        let status = 'In Progress';

        if (newId === oldNext) {
          action = 'next-stage';
        } else if (newId === oldPrevious) {
          action = 'previous-stage';
        } else if (stage.new.next === null) {
          action = 'completed';
          status = 'Completed';
        }

        const workflowStagesId = await this.idResolver.resolveWorkflowStagesId(newId);
        const prevWorkflowStagesId = await this.idResolver.resolveWorkflowStagesId(oldId);

        if (!workflowStagesId) {
          throw new Error(`Cannot resolve workflowStagesId for ${newId}`);
        }
        if (!prevWorkflowStagesId) {
          throw new Error(`Cannot resolve prevWorkflowStagesId for ${oldId}`);
        }

        return {
          activitiesType: 'application',
          activitiesAction: action,
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              status,
              currentStage: { id: workflowStagesId, stage: 'Temp', level: 2 }, // TODO: map this accurately later on
              previousStage: { id: prevWorkflowStagesId, stage: 'Temp', level: 1 }, // TODO: map this accurately later on
            },
          },
        };
      }

      case 'application_owner_assigned': {
        const newData = description?.new;
        if (!newData) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        const assigneeId = newData.pivot.assignee_id;
        const assigneeUserId = await this.idResolver.resolveUserId(assigneeId);
        const firstName = newData.first_name;

        if (!assigneeUserId) {
          throw new Error(`Cannot resolve assigneeUserId for ${assigneeId}`);
        }

        return {
          activitiesType: 'application',
          activitiesAction: 'created',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              createdById: assigneeUserId,
              assignees: [{ id: assigneeUserId, firstName, role: { name: 'superAdmin' } }],
            },
          },
        };
      }

      case 'assignee-added':
      case 'assignee-removed': {
        const assignee = description?.assignee;
        if (!assignee) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        return {
          activitiesType: 'application-misc',
          activitiesAction: 'updated',
          data: {
            data: {
              id: activitiesTypeId,
              contactId,
              appIdentifier,
              activitiesLabel: 'Assignee',
            },
          },
        };
      }

      case 'note-created': {
        // const noteData = description?.data;
        // const body = noteData ? `${noteData.title}: ${noteData.description}` : '';

        return {
          activitiesType: 'application-comment',
          activitiesAction: 'created',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              currentStage: { stage: '', level: 0, id: activitiesTypeId }, // TODO: map this later
            },
          },
        };
      }

      case 'documents': {
        return {
          activitiesType: 'application-document',
          activitiesAction: 'created',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              currentStage: { stage: '', level: 0, id: activitiesTypeId }, // TODO: Map this later
              documentType: '', // TODO: Map this later
            },
          },
        };
      }

      case 'document-deleted': {
        return {
          activitiesType: 'application-document',
          activitiesAction: 'deleted',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              currentStage: { stage: '', level: 0, id: activitiesTypeId }, // TODO: Map this later
              documentType: '', // TODO: Map this later
            },
          },
        };
      }

      case 'sub-agent-updated': {
        const referrer = description?.referrer?.new;
        if (!referrer) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        const agentId = await this.idResolver.resolveAgentId(referrer.id);

        return {
          activitiesType: 'application-sub-agent',
          activitiesAction: 'updated',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              hasAgentPartner: true,
              agentPartner: {
                applicationId: activitiesTypeId,
                subAgentPartnerId: agentId ?? undefined,
              },
            },
          },
        };
      }

      case 'super-agent-updated': {
        const referrer = description?.referrer?.new;
        if (!referrer) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        const agentId = await this.idResolver.resolveAgentId(referrer.id);

        return {
          activitiesType: 'application-super-agent',
          activitiesAction: 'updated',
          data: {
            data: {
              id: activitiesTypeId,
              appIdentifier,
              contactId,
              hasAgentPartner: true,
              agentPartner: {
                applicationId: activitiesTypeId,
                superAgentPartnerId: agentId ?? undefined,
              },
            },
          },
        };
      }

      case 'applied-intake-date-updated': {
        return {
          activitiesType: 'application-enrollment',
          activitiesAction: 'updated',
          data: {
            data: {
              id: activitiesTypeId,
              contactId,
              appIdentifier,
              activitiesLabel: '',
            },
          },
        };
      }

      case 'product-fee-updated': {
        const fee = description?.fee?.new;
        if (!fee) {
          return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
        }

        if (fee.discount && fee.discount !== '0') {
          return {
            activitiesType: 'application-discount',
            activitiesAction: 'updated',
            data: {
              data: {
                id: activitiesTypeId,
                contactId,
                appIdentifier,
                activitiesLabel: '',
              },
            },
          };
        }

        return {
          activitiesType: 'application-fee',
          activitiesAction: 'updated',
          data: {
            data: {
              productFeeAmount: parseFloat(fee.total) ?? 0,
              productFeeCurrency: 'AUD',
            },
          },
        };
      }

      default:
        return this.defaultActivity(activitiesTypeId, contactId, appIdentifier);
    }
  }

  private defaultActivity(
    activitiesTypeId: string,
    contactId: string,
    appIdentifier: string
  ): {
    activitiesType: ApplyIMSActivitiesType;
    activitiesAction: ApplyIMSActivitiesActionType;
    data: ApplyIMSActivitiesJsonField;
  } {
    return {
      activitiesType: 'application',
      activitiesAction: 'updated',
      data: {
        data: {
          id: activitiesTypeId,
          appIdentifier,
          contactId,
        },
      },
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
