import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import {
  ApplyIMSOfficeVisit,
  OfficeVisitStatus,
} from '../entities/applyims/office-visit.entity.js';
import { getConfig } from '../configs/index.js';
import { CheckinWithContext, CheckinComment } from '../extractors/checkin.extractor.js';

const OFFICE_NAME_BRANCH_REGEX = /-(\d+)$/;

export class CheckinTransformer extends BaseTransformer<CheckinWithContext, ApplyIMSOfficeVisit> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected async transformImpl(
    source: CheckinWithContext,
    id: string
  ): Promise<ApplyIMSOfficeVisit | null> {
    if (!source.checkInTime) {
      return null;
    }

    if (source.clientId == null) {
      return null;
    }

    const contactId = await this.idResolver.resolveContactId(source.clientId);
    if (!contactId) {
      return null;
    }

    const branchAgentcisId = this.parseBranchIdFromOfficeName(source.officeName);
    if (branchAgentcisId == null) {
      throw new Error(`Cannot parse branch id from office_name "${source.officeName}"`);
    }
    const branchId = await this.idResolver.resolveBranchId(branchAgentcisId);
    if (!branchId) {
      throw new Error(`Cannot resolve branchId ${branchAgentcisId}`);
    }

    const assigneeId = source.hostUserId
      ? await this.idResolver.resolveUserId(source.hostUserId)
      : null;

    const config = getConfig();
    const createdBy = config.migrationAdminUserId;

    const updatedAt = source.completedTime ?? source.attendedTime ?? source.checkInTime;

    return {
      id,
      agentcisId: source.uuid,
      contactId,
      assigneeId,
      branchId,
      createdBy,
      createdAt: source.checkInTime,
      updatedAt,
      sessionNotes: this.buildSessionNotes(source),
      sessionStart: source.attendedTime ? source.attendedTime.toISOString() : null,
      sessionEnd: source.completedTime ? source.completedTime.toISOString() : null,
      status: this.deriveStatus(source),
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
      throw new Error(`Invalid createdBy: ${target.createdBy}`);
    }
    if (!isUuid(target.branchId)) {
      throw new Error(`Invalid branchId: ${target.branchId}`);
    }
  }

  private parseBranchIdFromOfficeName(officeName: string | null): number | null {
    if (!officeName) return null;
    const match = officeName.match(OFFICE_NAME_BRANCH_REGEX);
    if (!match) return null;
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private deriveStatus(source: CheckinWithContext): OfficeVisitStatus {
    if (source.completedTime) return 'Completed';
    if (source.attendedTime) return 'Attending';
    if (!source.hostEmail) return 'Unattended';
    return 'Waiting';
  }

  private buildSessionNotes(source: CheckinWithContext): string {
    const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
    const placeholder = (s: string | null): string => (s && s.trim() !== '' ? s : '(none)');

    const visitDate = source.checkInTime ? fmt(source.checkInTime) : '(none)';

    let out = `--- VISIT PURPOSE ---\n\n${placeholder(source.visitCategory)} : ${placeholder(source.visitReason)} : ${visitDate}`;

    const validComments = source.comments.filter(
      (c): c is CheckinComment & { comment: string } => !!c.comment && c.comment.trim() !== ''
    );

    if (validComments.length > 0) {
      const lines = validComments
        .map((c) => {
          const author = c.authorName ?? 'Unknown';
          const when = c.commentTime ? fmt(c.commentTime) : '(none)';
          return `${author} : ${when} : ${c.comment}`;
        })
        .join('\n\n');
      out += `\n\n--- SESSION NOTES ---\n\n${lines}`;
    }

    return out;
  }
}
