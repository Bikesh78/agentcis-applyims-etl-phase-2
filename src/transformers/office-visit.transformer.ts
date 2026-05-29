import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { ApplyIMSOfficeVisit } from '../entities/applyims/office-visit.entity.js';
import { getConfig } from '../configs/index.js';
import { OfficeVisitWithNotes } from '../extractors/office-visit.extractor.js';
import { logger } from '../utils/logger.js';

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
    let createdBy = await this.idResolver.resolveUserId(source.userId);

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
    const config = getConfig();

    if (!createdBy) {
      logger.warn('Unresolved userId — falling back to migration admin user', {
        entityType: 'office-visits',
        sourceId: source.id,
        agentcisUserId: source.userId,
      });
      createdBy = config.migrationAdminUserId;
    }

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
    let out = `--- VISIT PURPOSE ---\n\n${source.createdByName} : ${source.visitCreatedAtFormatted} : ${source.visitPurpose ?? ''}`;

    if (source.activityNotes.length === 0) {
      return out;
    }

    const lines: string[] = [];
    for (const n of source.activityNotes) {
      if (!n.noteText) {
        logger.warn('Skipping office-visit activity note: unparseable attributes', {
          agentcisOfficeVisitId: source.id,
          authorName: n.authorName,
          createdAt: n.createdAtFormatted,
          rawAttributes: n.rawAttributes,
        });
        continue;
      }
      lines.push(`${n.authorName} : ${n.createdAtFormatted} : ${n.noteText}`);
    }

    out += `\n\n--- SESSION NOTES ---`;
    if (lines.length > 0) {
      out += `\n\n${lines.join('\n\n')}`;
    }

    return out;
  }
}
