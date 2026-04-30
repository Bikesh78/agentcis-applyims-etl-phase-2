export interface AgentBranch {
  name: string;
  isMainBranch: boolean;
  countryCode: string | null;
  phone: string | null;
  email: string;
}

export interface ApplyIMSAgentPartner {
  agentcisId: number;
  name: string;
  isSubAgent: boolean;
  isSuperAgent: boolean;
  taxNumber: string | null;
  deactivated: boolean;
  branches: AgentBranch[];
}
