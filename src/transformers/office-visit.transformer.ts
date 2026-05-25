import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ApplyIMSOfficeVisit } from '../entities/applyims/office-visit.entity.js';
import { getConfig } from '../configs/index.js';
import { OfficeVisitWithNotes } from '../extractors/office-visit.extractor.js';

export class OfficeVisitTransformer extends BaseTransformer<
  OfficeVisitWithNotes,
  ApplyIMSOfficeVisit
> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(
    source: OfficeVisitWithNotes,
    id: string
  ): Promise<ApplyIMSOfficeVisit | null> {
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
      sessionNotes: this.buildSessionNotes(source),
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

  private buildSessionNotes(source: OfficeVisitWithNotes): string {
    const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

    let out = `--- VISIT PURPOSE ---\n\n${source.createdByName} : ${fmt(source.createdAt)} : ${source.visitPurpose ?? ''}`;

    const notes = source.activityNotes.filter((n) => n.noteText);
    if (notes.length > 0) {
      const lines = notes
        .map((n) => `${n.authorName} : ${fmt(n.createdAt)} : ${n.noteText}`)
        .join('\n\n');
      out += `\n\n--- SESSION NOTES ---\n\n${lines}`;
    }

    return out;
  }
}
