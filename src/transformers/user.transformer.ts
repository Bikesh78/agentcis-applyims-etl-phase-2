import { BaseTransformer } from './base.transformer.js';
import { IdResolver } from './utils/id-resolver.js';
import { Users } from '../entities/agentcis/users.entity.js';
import { ApplyIMSUser } from '../entities/applyims/user.entity.js';
import { isUuid } from './utils/validators.js';
import { TenantConfig } from '../configs/tenant.config.js';

export class UserTransformer extends BaseTransformer<Users, ApplyIMSUser> {
  constructor(
    idResolver: IdResolver,
    private readonly tenantConfig: TenantConfig
  ) {
    super(idResolver);
  }

  protected getSourceId(source: Users): string {
    return `user:${source.id}`;
  }

  protected async transformImpl(source: Users, id: string): Promise<ApplyIMSUser | null> {
    if (source.branchId == null) {
      throw new Error(`User ${source.id} has no branch_id`);
    }
    const branchId = await this.idResolver.resolveBranchId(source.branchId);
    if (!branchId) {
      throw new Error(`Cannot resolve BranchId ${source.branchId} for user ${source.id}`);
    }

    return {
      id,
      firstName: source.firstName,
      lastName: source.lastName,
      agentcisId: String(source.id),
      email: source.email,
      password: source.password,
      isVerified: true,
      address1: null,
      address2: null,
      phone: source.phoneNumber,
      alternativePhone: null,
      country: null,
      cityOrState: null,
      timeZone: source.timezone,
      position: source.jobTitle,
      photo: source.photo,
      status: source.status === 1 ? 'active' : 'inactive',
      tokenVersion: 0,
      branchId,
      departmentId: null,
      companyId: this.tenantConfig.companyId,
      domain: this.tenantConfig.domain,
      deactivated: source.status !== 1,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      roleId: null,
      totalLogin: 0,
    };
  }

  protected validate(target: ApplyIMSUser): void {
    if (!target.email) {
      throw new Error(`Invalid email for user agentcis_id=${target.agentcisId}`);
    }
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
    if (!isUuid(target.branchId)) {
      throw new Error(`Invalid branchId UUID: ${target.branchId}`);
    }
  }
}
