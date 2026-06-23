import { DataSource } from 'typeorm';
import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { isUuid } from './utils/validators.js';
import { FieldMapper } from './utils/field-mappers.js';
import { Attachment, AttachmentableType } from '../entities/agentcis/attachments.entity.js';
import { ApplicationStages } from '../entities/agentcis/application-stages.entity.js';
import { ApplyIMSMedia, SubjectType } from '../entities/applyims/media.entity.js';
import { MappingRepository } from '../repositories/mapping.repository.js';
import { SkipByDesignError } from '../loaders/error-recovery.js';

export class AttachmentTransformer extends BaseTransformer<Attachment, ApplyIMSMedia> {
  constructor(
    idResolver: IdResolver,
    private fieldMapper: FieldMapper,
    private mappingRepo: MappingRepository,
    private agentcisDb: DataSource
  ) {
    super(idResolver);
  }

  static create(
    idResolver: IdResolver,
    etlDb: DataSource,
    agentcisDb: DataSource
  ): AttachmentTransformer {
    const fieldMapper = new FieldMapper();
    const mappingRepo = new MappingRepository(etlDb);
    return new AttachmentTransformer(idResolver, fieldMapper, mappingRepo, agentcisDb);
  }

  protected getSourceId(source: Attachment): string {
    return `attachment:${source.id}`;
  }

  protected async transformImpl(source: Attachment, id: string): Promise<ApplyIMSMedia | null> {
    const supportedTypes: AttachmentableType[] = ['application_stage', 'client'];

    if (!supportedTypes.includes(source.attachmentableType)) {
      throw new SkipByDesignError(`Unsupported attachmentableType: ${source.attachmentableType}`);
    }

    const applicationId =
      source.attachmentableType === 'application_stage'
        ? await this.getApplicationIdFromStage(source.attachmentableId)
        : null;

    const subjectId = await this.resolveSubjectId(
      source.attachmentableType,
      source.attachmentableId,
      applicationId
    );
    const createdBy = source.uploader ? await this.idResolver.resolveUserId(source.uploader) : null;

    const destinationPath = await this.resolvePath(source, applicationId);
    const bucketFileName = this.getBucketFileName(source.originalName, source.createdAt);
    const destinationS3Key = `${destinationPath}/${bucketFileName}`;

    return {
      id,
      agentcisInternalId: source.id,
      name: source.originalName,
      path: destinationPath,
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
      bucketFileName,
      stageId: null,
      sourceS3Key: source.path,
      destinationS3Key,
    };
  }

  protected validate(target: ApplyIMSMedia): void {
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
    if (target.subjectId && !isUuid(target.subjectId)) {
      throw new Error(`Invalid subjectId: ${target.subjectId}`);
    }
  }

  private async getApplicationIdFromStage(stageId: number): Promise<number> {
    const stage = await this.agentcisDb
      .getRepository(ApplicationStages)
      .findOne({ where: { id: stageId }, select: ['applicationId'] });
    if (!stage) {
      throw new Error(`Cannot find application_stage ${stageId}`);
    }
    return stage.applicationId;
  }

  private async resolveSubjectId(
    attachmentableType: AttachmentableType,
    attachmentableId: number,
    applicationId: number | null
  ): Promise<string | null> {
    switch (attachmentableType) {
      case 'application_stage':
        return await this.idResolver.resolveApplicationId(applicationId!);
      case 'client':
        return await this.idResolver.resolveContactId(attachmentableId);
      default:
        return null;
    }
  }

  private async resolvePath(source: Attachment, applicationId: number | null): Promise<string> {
    switch (source.attachmentableType) {
      case 'client':
        return `contact__agentcis_${source.attachmentableId}/Contact-Documents`;
      case 'application_stage': {
        const clientId = await this.mappingRepo.getClientIdByApplication(applicationId!);
        if (!clientId) {
          throw new Error(`Cannot resolve client ID for application ${applicationId}`);
        }
        return `contacts/contact__agentcis_${clientId}/applications/application__agentcis-${applicationId}/stage__application/supporting-documents`;
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
}
