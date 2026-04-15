import { DataSource } from 'typeorm';
import { IdResolver } from './utils/id-resolver.js';
import { isUuid } from './utils/validators.js';
import { FieldMapper } from './utils/field-mappers.js';
import { logger } from 'utils/logger.js';
import { Attachment, AttachmentableType } from 'entities/agentcis/attachments.entity.js';
import { ApplyIMSMedia, SubjectType } from 'entities/applyims/media.entity.js';
import { MappingRepository } from 'repositories/mapping.repository.js';

export class AttachmentTransformer {
  constructor(
    private idResolver: IdResolver,
    private fieldMapper: FieldMapper,
    private mappingRepo: MappingRepository
  ) {}

  static create(idResolver: IdResolver, etlDb: DataSource): AttachmentTransformer {
    const fieldMapper = new FieldMapper();
    const mappingRepo = new MappingRepository(etlDb);
    return new AttachmentTransformer(idResolver, fieldMapper, mappingRepo);
  }

  async transform(source: Attachment): Promise<ApplyIMSMedia> {
    const supportedTypes: AttachmentableType[] = ['application_stage', 'client'];

    if (!supportedTypes.includes(source.attachmentableType)) {
      logger.warn(
        `Skipping attachment ${source.id} - unsupported attachmentableType: ${source.attachmentableType}`
      );
      throw new Error(`Unsupported attachmentableType: ${source.attachmentableType}`);
    }

    const id = crypto.randomUUID();

    const subjectId = await this.resolveSubjectId(
      source.attachmentableType,
      source.attachmentableId
    );
    const createdBy = source.uploader ? await this.idResolver.resolveUserId(source.uploader) : null;

    // const stageId =
    //   source.attachmentableType === 'application_stage'
    //     ? await this.idResolver.resolveWorkflowStagesId(source.attachmentableId)
    //     : null;

    const transformed: ApplyIMSMedia = {
      id,
      name: source.originalName,
      path: await this.resolvePath(source),
      extension: '.' + source.type,
      subjectType: this.mapSubjectType(source.attachmentableType),
      size: source.fileSize,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      mediaType: 'Supporting Documents',
      mediaTypeCategory: 'Other Documents',
      isDeleted: false,
      createdBy,
      mimetype: this.mapMimeType(source.type),
      subjectId,
      bucketFileName: this.getBucketFileName(source.originalName, source.createdAt),

      stageId: null, // Unable to resolve this as it's not possible to pinpoint which application stage this document belongs to
    };

    this.validate(transformed);
    return transformed;
  }

  private async resolveSubjectId(
    attachmentableType: AttachmentableType,
    attachmentableId: number
  ): Promise<string | null> {
    switch (attachmentableType) {
      case 'application_stage':
        return await this.idResolver.resolveApplicationId(attachmentableId);
      // return null
      case 'client':
        return await this.idResolver.resolveContactId(attachmentableId);
      default:
        return null;
    }
  }

  private async resolvePath(source: Attachment): Promise<string> {
    switch (source.attachmentableType) {
      case 'client':
        return `contact__agentcis_${source.attachmentableId}/Contact-Documents/${source.originalName}`;
      case 'application_stage': {
        const agentcisAppId = source.attachmentableId;
        const applyimsAppId = await this.idResolver.resolveApplicationId(agentcisAppId);
        if (!applyimsAppId) {
          throw new Error(`Cannot resolve application UUID for application ${agentcisAppId}`);
        }
        const clientId = await this.mappingRepo.getAgentcisClientIdFromApplication(applyimsAppId);
        if (!clientId) {
          throw new Error(`Cannot resolve client ID for application ${agentcisAppId}`);
        }
        return `contacts/contact__agentcis_${clientId}/applications/application__agentcis-${source.attachmentableId}/stage__application/supporting-documents/${source.originalName}`;
      }
      default:
        throw new Error(`Unsupported attachmentableType: ${source.attachmentableType}`);
    }
  }

  private getBucketFileName(originalName: string, createdDate: Date): string {
    const timestamp = createdDate.getTime();
    return this.fieldMapper.removeNonASCIICharacters(`${timestamp}-${originalName}`);
  }

  private mapSubjectType(attachmentableType: AttachmentableType): SubjectType | null {
    switch (attachmentableType) {
      case 'application_stage':
        return 'ApplicationMedia';
      case 'client':
        return 'ContactMedia';
      default:
        return null;
    }
  }

  private mapMimeType(extension: string | null): string {
    if (!extension) return '';

    const mimeTypeMap: Record<string, string> = {
      bin: 'application/octet-stream',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      pdf: 'application/pdf',
      png: 'image/png',
      rtf: 'application/rtf',
      txt: 'text/plain',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip',
    };

    return mimeTypeMap[extension.toLowerCase()] ?? 'application/octet-stream';
  }

  private extractExtension(fileName: string | null): string | null {
    if (!fileName) return null;
    const parts = fileName.split('.');
    return parts.length > 1 ? (parts.pop() ?? null) : null;
  }

  private validate(media: ApplyIMSMedia): void {
    if (!isUuid(media.id)) {
      throw new Error(`Invalid UUID: ${media.id}`);
    }
    if (media.subjectId && !isUuid(media.subjectId)) {
      throw new Error(`Invalid subjectId: ${media.subjectId}`);
    }
  }
}
