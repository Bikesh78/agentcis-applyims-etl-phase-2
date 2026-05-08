export type ApplyIMSUserStatus = 'active' | 'inactive';

export interface ApplyIMSUser {
  id: string;
  firstName: string;
  lastName: string;
  agentcisId: string;
  email: string;
  password: string;
  isVerified: boolean;
  address1: string | null;
  address2: string | null;
  phone: string | null;
  alternativePhone: string | null;
  country: string | null;
  cityOrState: string | null;
  timeZone: string | null;
  position: string | null;
  photo: string | null;
  status: ApplyIMSUserStatus;
  tokenVersion: number;
  branchId: string;
  departmentId: string | null;
  companyId: string;
  domain: string;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
  roleId: string | null;
  totalLogin: number;

  agentcisClientId: string;
  agentcisInternalId: number;
}
