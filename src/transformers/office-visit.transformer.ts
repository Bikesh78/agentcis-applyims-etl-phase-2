import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { OfficeVisits } from '../entities/agentcis/office-visits.entity.js';
import { ApplyIMSOfficeVisit } from '../entities/applyims/office-visit.entity.js';
import { getConfig } from '../configs/index.js';

export class OfficeVisitTransformer extends BaseTransformer<OfficeVisits, ApplyIMSOfficeVisit> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(source: OfficeVisits, id: string): Promise<ApplyIMSOfficeVisit> {
    const contactId = await this.idResolver.resolveContactId(source.contactId);
    const assigneeId = source.assigneeId
      ? await this.idResolver.resolveUserId(source.assigneeId)
      : null;
    const branchId = await this.idResolver.resolveBranchId(source.officeId);
    const createdBy = await this.idResolver.resolveUserId(source.userId);

    const sessionStart =
      source.officeVisitAssignees.find((item) => Boolean(item.attendedOn))?.attendedOn || null;
    const sessionEnd =
      source.officeVisitAssignees.find((item) => Boolean(item.completedOn))?.completedOn || null;

    if (!contactId) {
      throw new Error(`Cannot resolve contactId ${source.contactId}`);
    }
    if (!branchId) {
      throw new Error(`Cannot resolve branchId from officeId ${source.officeId}`);
    }
    if (!createdBy) {
      throw new Error(`Cannot resolve userId ${source.userId}`);
    }

    const config = getConfig();

    return {
      id,
      agentcisId: source.id,
      contactId,
      assigneeId,
      branchId,
      createdBy,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      sessionNotes: source.visitPurpose,
      sessionStart,
      sessionEnd,
      status: sessionStart && sessionEnd ? 'Completed' : 'Unattended',
      visitPurposeId: config.visitPurposeId,
    };
  }

  protected validate(target: ApplyIMSOfficeVisit): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid uuid: ${target.id}`);
    }
    if (!isUuid(target.contactId)) {
      throw new Error(`Invalid contactId: ${target.contactId}`);
    }
    if (!isUuid(target.createdBy)) {
      throw new Error(`Invalid userId: ${target.createdBy}`);
    }
  }
}
