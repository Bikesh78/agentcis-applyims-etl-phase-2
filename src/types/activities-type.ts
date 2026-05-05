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

interface Reason {
  id: number;
  title: string;
  status: number;
}

interface Stage {
  old: {
    id: number;
    previous?: number;
    next: number;
  };
  new: {
    id: number;
    previous?: number;
    next: number | null;
  };
}

interface New {
  first_name: string;
  pivot: {
    assignee_id: number;
    is_owner: number;
  };
}
interface Assignee {
  id: number;
  name: string;
}
interface NoteData {
  title: string;
  description: string;
}
interface Attachments {
  original_name: string;
}
interface Referrer {
  new: {
    id: number;
    name: string;
  };
}
interface Fee {
  new: {
    total: string;
    discount: string;
  };
}

export interface AgentcisDescription {
  user_name?: string;
  reason?: Reason | null;
  reverted_completed_application?: boolean;
  stage?: Stage;
  new?: New;
  assignee?: Assignee;
  data?: NoteData;
  attachments?: Attachments[];
  referrer?: Referrer;
  value?: string;
  fee?: Fee;
}
