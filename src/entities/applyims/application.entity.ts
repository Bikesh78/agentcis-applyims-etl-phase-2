export type ApplyimsApplicationStatus = 'In Progress' | 'Completed' | 'Discontinued';

interface StatusReason {
  reason: string;
  remarks: string;
}
export type ApplyimsStatusRemarks = Partial<Record<'discontinue', StatusReason>>;

export interface AgentPartner {
  subAgentBranchId?: string;
  subAgentPartnerId?: string;
  superAgentBranchId?: string;
  superAgentPartnerId?: string;
}

export interface ApplyIMSApplication {
  id: string;
  agentcisApplicationId: number;
  contactId: string;
  institutionId: string;
  productId: string;
  workflowId: string;
  productType: string | null;
  productSubType: string | null;
  createdBy: string;
  status: ApplyimsApplicationStatus;
  activeStageId: string;
  intakeYear: number | null;
  intakeMonth: string | null;
  startDate: string | null;
  endDate: string | null;
  processingBranchId: string;
  partnerClientId: string | null;
  hasAgentPartner: boolean;
  createdAt: Date;
  updatedAt: Date;
  statusRemarks: ApplyimsStatusRemarks | null;
  discount: number;
  remarks: string | null;
  productFeeAmount: number;
  productFeeCurrency: string;
  institutionBranchId: string;
  dealId: string;
  assignees: { id: string }[];
  agentPartner: AgentPartner;
}
