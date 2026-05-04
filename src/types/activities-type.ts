export type AgenticActivitiesType =
  | 'reverted-discontinued-application'
  | 'reverted-completed-application'
  | 'discontinued-application'
  | 'application-stage-moved'
  | 'application_owner_assigned'
  | 'assignee-added'
  | 'assignee-removed'
  | 'note-created'
  | 'documents'
  | 'document-deleted'
  | 'sub-agent-updated'
  | 'super-agent-updated'
  | 'applied-intake-date-updated'
  | 'product-fee-updated';

export type ApplyIMSActivitiesType =
  | 'application'
  | 'application-misc'
  | 'application-comment'
  | 'application-document'
  | 'application-sub-agent'
  | 'application-super-agent'
  | 'application-enrollment'
  | 'application-fee'
  | 'application-discount';

export type ApplyIMSActivitiesActionType =
  | 'reverted'
  | 'reopened'
  | 'discontinued'
  | 'next-stage'
  | 'previous-stage'
  | 'completed'
  | 'created'
  | 'updated'
  | 'deleted';

interface ApplyIMSActivitviesStage {
  id: string;
  workflowId: string;
  stage: string;
  level: number;
  actor: string;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplyIMSJsonData {
  currentStage?: ApplyIMSActivitviesStage;
  previousStage?: ApplyIMSActivitviesStage;
  id: string;
  appIdentifier: string;
  contactId: string;
}

export interface ApplyIMSActivitiesJsonField {
  data: ApplyIMSJsonData;
}
