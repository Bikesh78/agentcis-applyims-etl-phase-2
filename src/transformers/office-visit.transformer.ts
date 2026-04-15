import { IdResolver } from './utils/id-resolver.js';
import { isUuid } from './utils/validators.js';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';
import { ApplyIMSOfficeVisit } from 'entities/applyims/office-visit.entity.js';

export class OfficeVisitTransformer {
  constructor(private idResolver: IdResolver) {}

  async transform(source: OfficeVisits): Promise<ApplyIMSOfficeVisit> {
    const id = crypto.randomUUID();
    const contactId = await this.idResolver.resolveContactId(source.contactId);
    const assigneeId = source.assigneeId
      ? await this.idResolver.resolveUserId(source.assigneeId)
      : null;
    const branchId = await this.idResolver.resolveBranchId(source.officeId);
    const createdBy = await this.idResolver.resolveUserId(source.userId);

    const sessionStart = source.officeVisitAssignees.find((item) =>
      Boolean(item.attendedOn)
    )?.attendedOn;
    const sessionEnd = source.officeVisitAssignees.find((item) =>
      Boolean(item.completedOn)
    )?.completedOn;

    if (!contactId) {
      throw new Error(`Cannot resolve contactId ${source.contactId}`);
    }
    if (!branchId) {
      throw new Error(`Cannot resolve branchId from officeId ${source.officeId}`);
    }
    if (!createdBy) {
      throw new Error(`Cannot resolve userId ${source.userId}`);
    }
    if (!sessionStart) {
      throw new Error(`Cannot resolve session start for ${source.id}`);
    }
    if (!sessionEnd) {
      throw new Error(`Cannot resolve session end for ${source.id}`);
    }

    const transformed: ApplyIMSOfficeVisit = {
      id,
      contactId,
      assigneeId,
      branchId,
      createdBy,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      sessionNotes: source.visitPurpose,
      sessionStart,
      sessionEnd,
      status: 'Completed',
    };

    this.validate(transformed);
    return transformed;
  }

  private validate(officeVisit: ApplyIMSOfficeVisit): void {
    if (!isUuid(officeVisit.id)) {
      throw new Error(`Invalid uuid: ${officeVisit.id}`);
    }
    if (!isUuid(officeVisit.contactId)) {
      throw new Error(`Invalid contactId: ${officeVisit.contactId}`);
    }
    if (!isUuid(officeVisit.createdBy)) {
      throw new Error(`Invalid userId: ${officeVisit.createdBy}`);
    }
  }
}
