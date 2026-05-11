import { IdResolver } from './utils/id-resolver.js';
import { ProductTypeResolver } from './utils/product-type-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isDate, isUuid } from './utils/validators.js';
import { AgentcisApplicationType, Applications } from '../entities/agentcis/applications.entity.js';
import {
  AgentPartner,
  ApplyIMSApplication,
  ApplyimsApplicationStatus,
  ApplyimsStatusRemarks,
} from '../entities/applyims/application.entity.js';
import { Referrers } from '../entities/agentcis/referrers.entity.js';

export class ApplicationTransformer extends BaseTransformer<Applications, ApplyIMSApplication> {
  constructor(
    idResolver: IdResolver,
    private readonly productTypeResolver: ProductTypeResolver
  ) {
    super(idResolver);
  }

  protected async transformImpl(
    source: Applications,
    id: string
  ): Promise<ApplyIMSApplication | null> {
    const existingApplicationId = await this.idResolver.checkApplicationId(source.id);
    if (existingApplicationId) {
      return null;
    }

    const contactId = await this.idResolver.resolveContactId(source.clientId);
    const branchId = await this.idResolver.resolveBranchId(source.addedByBranchId);
    const createdBy = await this.idResolver.resolveUserId(source.creatorId);
    const workflowId = await this.idResolver.resolveWorkflowId(source.serviceId);
    const workflowStagesId = await this.idResolver.resolveWorkflowStagesId(source.currentStage);
    const productId = await this.idResolver.resolveProductId(source.products.id);
    const agentId = await this.idResolver.resolveAgentId(source.referrers?.id);
    const institutionBranchId = await this.idResolver.resolveInstitutionBranchesId(
      source.vendorBranchId
    );
    const institutionId = await this.idResolver.resolveInstitutions(source.products.vendorId);

    const assigneeIds = source.applicationAssignees?.map((a) => a.assigneeId) ?? [];
    const assignees = await this.idResolver.resolveUserIds(assigneeIds);
    const dealId = await this.idResolver.resolveDealId(source.id);

    if (!contactId) {
      throw new Error(`Cannot resolve contactId ${source.clientId}`);
    }
    if (!branchId) {
      throw new Error(`Cannot resolve branchId ${source.addedByBranchId}`);
    }
    if (!productId) {
      throw new Error(`Cannot resolve productId ${source.products.id}`);
    }
    if (!createdBy) {
      throw new Error(`Cannot resolve userId ${source.creatorId}`);
    }
    if (!workflowId) {
      throw new Error(`Cannot resolve workflowId ${source.serviceId}`);
    }
    if (!workflowStagesId) {
      throw new Error(`Cannot resolve workflowStagesId ${source.currentStage}`);
    }
    if (!institutionBranchId) {
      throw new Error(`Cannot resolve institutionBranchId ${source.vendorBranchId}`);
    }
    if (!institutionId) {
      throw new Error(`Cannot resolve institutionId ${source.products.vendorId}`);
    }
    if (!dealId) {
      throw new Error(`Cannor resolve dealId for application ${source.id}`);
    }

    const intakes = source.appliedIntakeDate
      ? this.extractIntakeYearAndMonth(source.appliedIntakeDate)
      : undefined;

    const [productType, productSubType] = await Promise.all([
      this.productTypeResolver.getProductType(productId),
      this.productTypeResolver.getProductSubType(productId),
    ]);

    return {
      id,
      agentcisApplicationId: source.id,
      contactId,
      productId,
      institutionId,
      institutionBranchId,
      workflowId,
      createdBy,
      status: this.mapStatus(source.status),
      activeStageId: workflowStagesId,
      intakeYear: intakes?.intakeYear ?? null,
      intakeMonth: intakes?.intakeMonth ?? null,
      startDate: source.startDate.toISOString().split('T')[0],
      endDate: source.endDate.toISOString().split('T')[0],
      processingBranchId: branchId,
      partnerClientId: source.applicationId,
      hasAgentPartner: Boolean(source.superAgentId),
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      statusRemarks: this.mapDiscontinuedStatusRemarks(source.discontinuedReason),
      agentPartner: agentId ? this.getAgentPartner(source.referrers, agentId) : {},
      assignees,
      ...this.extractDiscountAndRemarks(source),
      dealId,
      productType,
      productSubType,
      productFeeAmount: 0,
      productFeeCurrency: '',
    };
  }

  protected validate(target: ApplyIMSApplication): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
    if (!isUuid(target.contactId)) {
      throw new Error(`Invalid ContactId: ${target.contactId}`);
    }
    if (!isUuid(target.dealId)) {
      throw new Error(`Invalid DealId: ${target.dealId}`);
    }
  }

  private getAgentPartner(referrer: Referrers | null, applyimsId: string): AgentPartner {
    if (referrer?.agentType.length === 2) {
      return {
        superAgentPartnerId: applyimsId,
        subAgentPartnerId: applyimsId,
      };
    } else if (referrer?.agentType[0] === 1) {
      return { superAgentPartnerId: applyimsId };
    } else {
      return { subAgentPartnerId: applyimsId };
    }
  }

  private mapStatus(status: AgentcisApplicationType): ApplyimsApplicationStatus {
    const statusMap: Record<AgentcisApplicationType, ApplyimsApplicationStatus> = {
      Open: 'In Progress',
      Complete: 'Completed',
      Discontinue: 'Discontinued',
    };
    return statusMap[status];
  }

  private extractIntakeYearAndMonth(dateStr: string): { intakeYear: number; intakeMonth: string } {
    if (!isDate(dateStr)) {
      throw new Error(`Invalid date string ${dateStr}`);
    }
    const date = new Date(dateStr);

    const intakeYear = date.getFullYear();
    const intakeMonth = date.toLocaleString('en-US', { month: 'long' });

    return { intakeYear, intakeMonth };
  }

  private mapDiscontinuedStatusRemarks(discontinuedReason: string | null): ApplyimsStatusRemarks {
    if (!discontinuedReason) return {};

    const reasonMap: Record<string, string> = {
      'Enrolled in Other Application': 'Enrolled into Another Course',
      'Error by Team Member': 'Error by Team Member',
      'Financial Difficulties': 'Financial Issues',
      'Client Lost': 'Withdrawn',
      'Rejected by Institution': 'Rejected by Institution',
      'Test Data': 'Others',
      'Other Reason': 'Others',
      'Visa Rejected': 'Visa Denied',
      Refund: 'Others',
      Withdraw: 'Withdrawn',
    };
    const reason = reasonMap[discontinuedReason];

    return {
      discontinue: {
        reason,
        remarks: 'Migrated from Agentcis',
      },
    };
  }

  private extractDiscountAndRemarks(source: Applications): { discount: number; remarks: string } {
    const groupProductFee = source.groupProductFees?.find((f) => f.feeableType === 'application');

    if (!groupProductFee) {
      return { discount: 0, remarks: '' };
    }

    const totalFees = groupProductFee.total ?? 0;
    const discountValue =
      typeof groupProductFee.discount === 'number'
        ? groupProductFee.discount
        : (groupProductFee.discount?.value ?? 0);
    const finalFee = totalFees - discountValue;

    return {
      discount: discountValue,
      remarks: `Total Fees $${totalFees} - Discount $${discountValue} = Final Fee $${finalFee}`,
    };
  }
}
