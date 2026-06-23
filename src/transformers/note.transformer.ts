import { BaseTransformer } from './base.transformer.js';
import { IdResolver } from './utils/id-resolver.js';
import { isUuid } from './utils/validators.js';
import { AgentcisNoteWithRelations } from '../extractors/note.extractor.js';
import { ApplyIMSNote } from '../entities/applyims/note.entity.js';
import { getConfig } from '../configs/index.js';
import { logger } from '../utils/logger.js';

export class NoteTransformer extends BaseTransformer<AgentcisNoteWithRelations, ApplyIMSNote> {
  constructor(idResolver: IdResolver) {
    super(idResolver);
  }

  protected getSourceId(source: AgentcisNoteWithRelations): string {
    return `note:${source.id}`;
  }

  protected async transformImpl(
    source: AgentcisNoteWithRelations,
    id: string
  ): Promise<ApplyIMSNote | null> {
    if (source.notableType !== 'application_stage' && source.notableType !== 'client') {
      return null;
    }

    let createdById = await this.idResolver.resolveUserId(source.addedBy);
    if (!createdById) {
      logger.warn('Unresolved userId — falling back to migration admin user', {
        entityType: 'notes',
        sourceId: source.id,
        agentcisUserId: source.addedBy,
      });
      createdById = getConfig().migrationAdminUserId;
    }

    const description = source.title
      ? `${source.title}\n${source.description}`
      : source.description;

    const note: ApplyIMSNote = {
      id,
      description,
      type: 'note',
      createdById,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      agentcisId: source.id,
    };

    if (source.notableType === 'application_stage') {
      if (source.agentcisApplicationId == null) {
        throw new Error(
          `Cannot resolve applicationId: application_stage ${source.notableId} has no application`
        );
      }
      const applicationId = await this.idResolver.resolveApplicationId(
        source.agentcisApplicationId
      );
      if (!applicationId) {
        throw new Error(
          `Cannot resolve applicationId for agentcis application ${source.agentcisApplicationId}`
        );
      }
      note.applicationId = applicationId;
    } else {
      const contactId = await this.idResolver.resolveContactId(source.notableId);
      if (!contactId) {
        throw new Error(`Cannot resolve contactId for notable_id ${source.notableId}`);
      }
      note.contactId = contactId;
    }

    return note;
  }

  protected validate(target: ApplyIMSNote): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid uuid: ${target.id}`);
    }
    if (!isUuid(target.createdById)) {
      throw new Error(`Invalid createdById: ${target.createdById}`);
    }
  }
}
