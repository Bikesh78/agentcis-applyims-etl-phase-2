export type OfficeVisitStatus = 'Pending' | 'Waiting' | 'Attending' | 'Completed' | 'Unattended';

export interface ApplyIMSOfficeVisit {
  id: string;
  agentcisId: number | string;
  contactId: string;
  assigneeId: string | null;
  branchId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sessionNotes: string | null;
  sessionStart: string | null;
  sessionEnd: string | null;
  status: OfficeVisitStatus;
  visitPurposeId: string;
}
