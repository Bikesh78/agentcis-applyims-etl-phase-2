export interface ApplyIMSNote {
  id: string;
  description: string;
  type: 'note';
  createdById: string;
  applicationId?: string;
  contactId?: string;
  createdAt: Date;
  updatedAt: Date;
}
