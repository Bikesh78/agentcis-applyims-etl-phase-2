export interface AssigneeInput {
  id: string;
}

export interface Payload {
  countries: string[];
  typeOfService: string;
  services: string[];
}

export interface ApplyIMSDeal {
  id: string;
  name: string;
  branchId: string;
  interestedServiceId: string;
  assignees: AssigneeInput[];
  contactId: string;
  status: string;
  payload: Payload;
  enquiryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
