import { DataSource } from 'typeorm';
import { BaseExtractor, ExtractorConfig } from '../extractors/base.extractor.js';
import { ContactExtractor } from '../extractors/contact.extractor.js';
import { ApplicationExtractor } from '../extractors/application.extractor.js';
import { DealExtractor } from '../extractors/deal.extractor.js';
import { OfficeVisitExtractor } from '../extractors/office-visit.extractor.js';
import { AttachmentExtractor } from '../extractors/attachment.extractor.js';
import { ReferrerExtractor } from '../extractors/referrer.extractor.js';
import {
  ContactActivityExtractor,
  ApplicationActivityWithRelations,
} from '../extractors/contact-activity.extractor.js';
import { UserExtractor } from '../extractors/user.extractor.js';
import { NoteExtractor, AgentcisNoteWithRelations } from '../extractors/note.extractor.js';
import { ContactTransformer } from '../transformers/contact.transformer.js';
import { ApplicationTransformer } from '../transformers/application.transformer.js';
import { DealTransformer } from '../transformers/deal.transformer.js';
import { OfficeVisitTransformer } from '../transformers/office-visit.transformer.js';
import { AttachmentTransformer } from '../transformers/attachment.transformer.js';
import { AgentTransformer } from '../transformers/agent.transformer.js';
import { ContactActivityTransformer } from '../transformers/contact-activity.transformer.js';
import { UserTransformer } from '../transformers/user.transformer.js';
import { NoteTransformer } from '../transformers/note.transformer.js';
import { IdResolver } from '../transformers/utils/id-resolver.js';
import { ProductTypeResolver } from '../transformers/utils/product-type-resolver.js';
import { FieldMapper } from '../transformers/utils/field-mappers.js';
import { BatchProcessor, ProcessResult } from '../loaders/batch-processor.js';
import { CheckpointService } from '../services/checkpoint.service.js';
import { ErrorRecoveryManager, ErrorCategory } from '../loaders/error-recovery.js';
import { ApplyIMSApiClient, BulkResponse } from '../loaders/api-client.js';
import { Logger } from '../utils/logger.js';
import { MigrationJob, MigrationStatus } from '../entities/etlDb/migration-jobs.entity.js';
import { MigrationConfig } from '../configs/migration.config.js';
import {
  EntityType,
  ENTITY_DEPENDENCY_ORDER,
  SUPPORTED_ENTITIES,
} from '../constants/entity-types.js';
import { Clients } from '../entities/agentcis/clients.entity.js';
import { Applications } from '../entities/agentcis/applications.entity.js';
import { OfficeVisits } from '../entities/agentcis/office-visits.entity.js';
import { Attachment } from '../entities/agentcis/attachments.entity.js';
import { ApplyIMSContact } from '../entities/applyims/contact.entity.js';
import { ApplyIMSApplication } from '../entities/applyims/application.entity.js';
import { ApplyIMSDeal } from '../entities/applyims/deal.entity.js';
import { ApplyIMSOfficeVisit } from '../entities/applyims/office-visit.entity.js';
import { ApplyIMSMedia } from '../entities/applyims/media.entity.js';
import { ApplyIMSAgentPartner } from '../entities/applyims/agent.entity.js';
import { ApplyIMSContactActivity } from '../entities/applyims/contact-activity.entity.js';
import { ApplyIMSUser } from '../entities/applyims/user.entity.js';
import { ApplyIMSNote } from '../entities/applyims/note.entity.js';
import { Users } from '../entities/agentcis/users.entity.js';
import { ReferrerBatch } from '../extractors/referrer.extractor.js';
import { MappingRepository, DealMappingData } from 'repositories/mapping.repository.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';
import { TempMappedContact } from '../entities/etlDb/temp-mapped-contacts.entity.js';
import { S3CopyService } from '../services/s3-copy.service.js';
import { S3BucketConfig } from '../configs/s3-bucket.config.js';
import { TenantConfig } from '../configs/tenant.config.js';
import { ApplicationActivities } from 'entities/agentcis/application-activities.entity.js';

export interface EntityMigrationResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
}

export interface MigrationResult {
  migrationId: string;
  status: 'completed' | 'failed' | 'partial' | 'cancelled';
  duration: number;
  entities: Record<string, EntityMigrationResult>;
}

type SourceEntity =
  | Clients
  | Applications
  | OfficeVisits
  | Attachment
  | ReferrerBatch
  | ApplicationActivities
  | Users;

type TargetEntity =
  | ApplyIMSContact
  | ApplyIMSApplication
  | ApplyIMSDeal
  | ApplyIMSOfficeVisit
  | ApplyIMSMedia
  | ApplyIMSAgentPartner
  | ApplyIMSContactActivity
  | ApplyIMSUser
  | ApplyIMSNote;

interface EntityHandlers {
  extractor: BaseExtractor<SourceEntity>;
  transformer: { transform: (item: SourceEntity) => Promise<TargetEntity> };
  apiMethod: (batch: TargetEntity[]) => Promise<BulkResponse>;
}

interface StagingDealApplications {
  clientId: number;
  addedByBranchId: number;
  userId: number;
  startDate: Date;
  endDate: Date;
  bucket: string | number;
  total: string | number;
  applicationIds: string;
  serviceId: string | number;
}

export class MigrationOrchestrator {
  private isCancelled = false;

  constructor(
    private agentcisDb: DataSource,
    private etlDb: DataSource,
    private apiClient: ApplyIMSApiClient,
    private batchProcessor: BatchProcessor,
    private checkpointService: CheckpointService,
    private errorRecoveryManager: ErrorRecoveryManager,
    private mappingRepository: MappingRepository,
    private s3CopyService: S3CopyService,
    private s3BucketConfig: S3BucketConfig,
    private tenantConfig: TenantConfig,
    private logger: Logger
  ) {}

  async runMigration(config: MigrationConfig): Promise<MigrationResult> {
    const startTime = Date.now();
    const { migrationId } = config;
    this.logger.info('Migration started', { migrationId });

    const orderedEntities = this.reorderEntities(config.entities);
    this.logger.info('Entity migration order determined', {
      migrationId,
      order: orderedEntities,
    });
    config.entities = orderedEntities;

    await this.createMigrationJob(config);

    await this.validateCredentials();

    const results: Record<string, EntityMigrationResult> = {};

    try {
      for (const entityType of config.entities) {
        if (!SUPPORTED_ENTITIES.includes(entityType as EntityType)) {
          this.logger.warn('Skipping unsupported entity', { migrationId, entityType });
          continue;
        }

        if (this.isCancelled) {
          this.logger.warn('Migration cancelled', { migrationId });
          break;
        }

        const entityStartTime = Date.now();
        const result = await this.migrateEntity(config, entityType, entityStartTime);
        const entityElapsedMs = Date.now() - entityStartTime;
        this.logger.info('Entity migration completed', {
          migrationId,
          entityType,
          successful: result.successful,
          total: result.total,
          elapsedMs: entityElapsedMs,
        });
        results[entityType] = result;

        if (entityType === EntityType.CONTACTS) {
          await this.populateDealStaging(config);
        }

        if (entityType === EntityType.ATTACHMENTS) {
          await this.copyS3FilesForMedias(config.migrationId);
        }
      }

      await this.updateMigrationJob(migrationId, MigrationStatus.COMPLETED);
      const totalElapsedMs = Date.now() - startTime;
      this.logger.info('Migration completed', {
        migrationId,
        status: Object.values(results).some((r) => r.failed > 0) ? 'partial' : 'completed',
        duration: totalElapsedMs,
        entityResults: Object.fromEntries(
          Object.entries(results).map(([key, val]) => [
            key,
            { successful: val.successful, failed: val.failed, skipped: val.skipped },
          ])
        ),
      });
      return {
        migrationId,
        status: Object.values(results).some((r) => r.failed > 0) ? 'partial' : 'completed',
        duration: totalElapsedMs,
        entities: results,
      };
    } catch (error) {
      this.logger.error('Migration failed', {
        migrationId,
        error: String(error),
      });
      await this.updateMigrationJob(migrationId, MigrationStatus.FAILED, (error as Error).message);
      throw error;
    }
  }

  private async migrateEntity(
    config: MigrationConfig,
    entityType: EntityType,
    entityStartTime: number
  ): Promise<EntityMigrationResult> {
    const { migrationId } = config;
    this.logger.info('Starting entity migration', { migrationId, entityType });

    let lastProcessedId: number | null = null;

    if (config.resumeFrom?.checkpointId) {
      const checkpoint = await this.checkpointService.getCheckpoint(migrationId, entityType);
      if (checkpoint && checkpoint.lastProcessedId && !checkpoint.completedAt) {
        lastProcessedId = parseInt(checkpoint.lastProcessedId, 10);
      }
    }

    const extractorConfig: ExtractorConfig = {
      batchSize: config.batchSize,
      startDate: config.dateRange.start,
      endDate: config.dateRange.end,
      checkpointId: config.resumeFrom?.checkpointId,
      lastProcessedId,
    };

    const handlers = this.getEntityHandlers(entityType, extractorConfig, migrationId);

    const totalCount = await handlers.extractor.getTotalCount();
    this.logger.info('Entity count fetched', { migrationId, entityType, totalCount });

    await this.checkpointService.createCheckpoint({
      migrationId,
      entityType,
      totalCount,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: new Date(),
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for await (const batch of handlers.extractor.extractAll()) {
      if (this.isCancelled) break;

      const transformed: TargetEntity[] = [];
      const transformResults = await Promise.allSettled(
        batch.map((item) => handlers.transformer.transform(item))
      );

      for (let i = 0; i < transformResults.length; i++) {
        const result = transformResults[i];
        if (result.status === 'fulfilled' && result.value !== null) {
          transformed.push(result.value);
        } else if (result.status === 'fulfilled' && result.value === null) {
          skippedCount++;
        } else if (result.status === 'rejected') {
          const error =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          this.logger.error('Transform error for item', {
            migrationId,
            entityType,
            itemId: String(batch[i]?.id ?? 'unknown'),
            error: String(error),
          });
          await this.errorRecoveryManager.logError(
            migrationId,
            entityType,
            String(batch[i]?.id ?? 'unknown'),
            error,
            ErrorCategory.TRANSFORMATION_ERROR,
            { payload: batch[i] }
          );
          skippedCount++;
        }
      }

      if (transformed.length === 0) {
        processedCount += batch.length;
        this.logger.warn('All transforms failed for batch, skipping', {
          migrationId,
          entityType,
          batchSize: batch.length,
        });
        continue;
      }

      if (transformed.length < batch.length) {
        processedCount += batch.length;
      } else {
        processedCount += transformed.length;
      }

      const batchStartTime = Date.now();
      const result: ProcessResult = await this.batchProcessor.processBatch(
        transformed as ApplyIMSContact[],
        entityType,
        handlers.apiMethod as (batch: ApplyIMSContact[]) => Promise<BulkResponse>,
        migrationId,
        config.batchSize
      );
      const batchElapsedMs = Date.now() - batchStartTime;

      if (entityType === EntityType.ATTACHMENTS) {
        for (const media of transformed as ApplyIMSMedia[]) {
          if (media.agentcisInternalId && media.sourceS3Key && media.destinationS3Key) {
            try {
              await this.mappingRepository.updateMediaS3Keys(
                media.agentcisInternalId,
                media.sourceS3Key,
                media.destinationS3Key
              );
            } catch (err) {
              this.logger.error('Failed to update S3 keys for media', {
                migrationId,
                mediaId: media.agentcisInternalId,
                error: String(err),
              });
            }
          }
        }
      }

      successCount += result.successful;
      failedCount += result.failed;
      skippedCount += result.skipped;

      await this.checkpointService.updateCheckpoint(migrationId, entityType, {
        processedCount,
        successCount,
        failedCount,
        lastProcessedId: String(batch[batch.length - 1]?.id),
      });

      const percentage = ((processedCount / totalCount) * 100).toFixed(2);
      const elapsedMs = Date.now() - entityStartTime;
      this.logger.progress('Entity progress update', {
        migrationId,
        entityType,
        processedCount,
        totalCount,
        percentage,
        elapsedMs,
        batchElapsedMs,
        successful: result.successful,
        failed: result.failed,
      });
    }

    await this.checkpointService.updateCheckpoint(migrationId, entityType, {
      completedAt: new Date(),
    });

    return {
      total: totalCount,
      successful: successCount,
      failed: failedCount,
      skipped: skippedCount,
    };
  }

  private getEntityHandlers(
    entityType: string,
    config: ExtractorConfig,
    migrationId: string
  ): EntityHandlers {
    switch (entityType) {
      case EntityType.CONTACTS: {
        const extractor = new ContactExtractor(this.agentcisDb, config);
        const transformer = new ContactTransformer(
          this.createIdResolver(),
          this.createFieldMapper()
        );
        return {
          extractor: extractor as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) => transformer.transform(item as Clients) as Promise<TargetEntity>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateContacts(batch as ApplyIMSContact[]),
        };
      }
      case EntityType.APPLICATIONS: {
        const extractor = new ApplicationExtractor(this.agentcisDb, config);
        const transformer = new ApplicationTransformer(
          this.createIdResolver(),
          this.createProductTypeResolver()
        );
        return {
          extractor: extractor as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as Applications) as Promise<TargetEntity>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateApplications(batch as ApplyIMSApplication[]),
        };
      }
      case EntityType.DEALS: {
        const extractor = new DealExtractor(this.etlDb, migrationId, config);
        const transformer = new DealTransformer();
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as unknown as TempMappedDeal) as Promise<TargetEntity>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateDeals(batch as ApplyIMSDeal[]),
        };
      }
      case EntityType.OFFICE_VISITS: {
        const extractor = new OfficeVisitExtractor(this.agentcisDb, config);
        const transformer = new OfficeVisitTransformer(this.createIdResolver());
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as OfficeVisits) as Promise<ApplyIMSOfficeVisit>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateOfficeVisits(batch as ApplyIMSOfficeVisit[]),
        };
      }
      case EntityType.ATTACHMENTS: {
        const extractor = new AttachmentExtractor(this.agentcisDb, config);
        const transformer = AttachmentTransformer.create(this.createIdResolver(), this.etlDb);
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as Attachment) as Promise<ApplyIMSMedia>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateMedia(batch as ApplyIMSMedia[]),
        };
      }
      case EntityType.AGENTS: {
        const extractor = new ReferrerExtractor(this.agentcisDb, config);
        const transformer = new AgentTransformer(this.createIdResolver(), this.createFieldMapper());
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as ReferrerBatch) as Promise<ApplyIMSAgentPartner>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateAgents(batch as ApplyIMSAgentPartner[]),
        };
      }
      case EntityType.CONTACT_ACTIVITIES: {
        const extractor = new ContactActivityExtractor(this.agentcisDb, config);
        const transformer = new ContactActivityTransformer(this.createIdResolver());
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(
                item as unknown as ApplicationActivityWithRelations
              ) as Promise<ApplyIMSContactActivity>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateContactActivities(batch as ApplyIMSContactActivity[]),
        };
      }
      case EntityType.USERS: {
        const extractor = new UserExtractor(this.agentcisDb, config);
        const transformer = new UserTransformer(this.createIdResolver(), this.tenantConfig);
        return {
          extractor: extractor as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) => transformer.transform(item as Users) as Promise<TargetEntity>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateUsers(batch as ApplyIMSUser[]),
        };
      }
      case EntityType.NOTES: {
        const extractor = new NoteExtractor(this.agentcisDb, config);
        const transformer = new NoteTransformer(this.createIdResolver());
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(
                item as unknown as AgentcisNoteWithRelations
              ) as Promise<ApplyIMSNote>,
          },
          apiMethod: (batch) => this.apiClient.bulkCreateNotes(batch as ApplyIMSNote[]),
        };
      }
      default:
        throw new Error(`No handler for entity: ${entityType}`);
    }
  }

  private async populateDealStaging(config: MigrationConfig): Promise<void> {
    const { migrationId } = config;
    this.logger.info('Populating deal staging data', { migrationId });

    const migratedContacts = await this.etlDb.getRepository(TempMappedContact).find({
      where: { migrationId },
      select: ['agentcisContactId'],
    });

    if (migratedContacts.length === 0) {
      this.logger.warn('No migrated contacts found for deal staging', { migrationId });
      return;
    }

    const migratedClientIds = migratedContacts.map((c) => c.agentcisContactId);

    const applications: StagingDealApplications[] = await this.agentcisDb
      .createQueryBuilder()
      .select([
        't.client_id AS "clientId"',
        't.added_by_branch_id AS "addedByBranchId"',
        't.user_id AS "userId"',
        'MIN(t.created_at) AS "startDate"',
        'DATE_ADD(MIN(t.first_app_date), INTERVAL (t.bucket + 1) * 6 MONTH) AS "endDate"',
        't.bucket AS "bucket"',
        'COUNT(*) AS "total"',
        'GROUP_CONCAT(t.id) AS "applicationIds"',
        'MIN(t.service_id) AS "serviceId"',
      ])
      .from((subQuery) => {
        return subQuery
          .select('app.*')
          .addSelect('c.user_id', 'user_id')
          .addSelect(
            'MIN(app.created_at) OVER (PARTITION BY app.client_id, app.added_by_branch_id)',
            'first_app_date'
          )
          .addSelect(
            'FLOOR(TIMESTAMPDIFF(MONTH, MIN(app.created_at) OVER (PARTITION BY app.client_id, app.added_by_branch_id), app.created_at) / 6)',
            'bucket'
          )
          .from(Applications, 'app')
          .innerJoin(Clients, 'c', 'c.id = app.client_id')
          .where('app.client_id IN (:...clientIds)', { clientIds: migratedClientIds });
      }, 't')
      .groupBy('t.client_id')
      .addGroupBy('t.added_by_branch_id')
      .addGroupBy('t.bucket')
      .addGroupBy('t.user_id')
      .orderBy('t.client_id')
      .addOrderBy('t.bucket')
      .getRawMany();

    const idResolver = this.createIdResolver();
    const dealRows: DealMappingData[] = [];

    for (const app of applications) {
      const contactId = await idResolver.resolveContactId(app.clientId);
      const branchId = await idResolver.resolveBranchId(app.addedByBranchId);
      const userId = app.userId ? await idResolver.resolveUserId(app.userId) : null;
      const serviceId = app.serviceId
        ? await idResolver.resolveServiceId(Number(app.serviceId))
        : null;
      const startDate = new Date(app.startDate);
      const endDate = new Date(app.endDate);

      if (!contactId) {
        this.logger.warn('Skipping deal staging - contactId not found', {
          migrationId,
          clientId: app.clientId,
        });
        continue;
      }

      const dealId = crypto.randomUUID();
      const applicationIds = (app.applicationIds ?? '').split(',').filter(Boolean);

      for (const appId of applicationIds) {
        dealRows.push({
          dealId,
          contactId,
          branchId: branchId ?? undefined,
          clientId: app.clientId,
          applicationId: parseInt(appId, 10),
          minimumDate: startDate,
          maxDate: endDate,
          dealName: this.generateDealName(startDate, endDate),
          userId,
          serviceId,
        });
      }
    }

    await this.mappingRepository.storeDealStagingBatch(migrationId, dealRows);
    this.logger.info('Deal staging populated', { migrationId, rowCount: dealRows.length });
  }

  private generateDealName(startDate: Date, endDate: Date): string {
    const startMonth = startDate.toLocaleString('default', { month: 'short' });
    const endMonth = endDate.toLocaleString('default', { month: 'short' });
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    return `Agentcis - ${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }

  private createIdResolver(): IdResolver {
    return IdResolver.createPhaseResolver(this.etlDb, this.logger);
  }

  private createFieldMapper(): FieldMapper {
    return new FieldMapper();
  }

  private createProductTypeResolver(): ProductTypeResolver {
    return new ProductTypeResolver(this.logger);
  }

  private async validateCredentials(): Promise<void> {
    this.logger.info('Validating ApplyIMS API credentials');
    await this.apiClient.authenticate();
  }

  private async createMigrationJob(config: MigrationConfig): Promise<void> {
    const { migrationId } = config;
    const jobRepo = this.etlDb.getRepository(MigrationJob);
    const job = jobRepo.create({
      id: migrationId,
      status: MigrationStatus.IN_PROGRESS,
      config: {
        entities: config.entities,
        dateRange: {
          start: config.dateRange.start.toISOString(),
          end: config.dateRange.end.toISOString(),
        },
        batchSize: config.batchSize,
        parallelism: config.parallelism,
      },
      startedAt: new Date(),
    });
    await jobRepo.save(job);
    this.logger.info('Migration job created', { migrationId });
  }

  private async updateMigrationJob(
    migrationId: string,
    status: MigrationStatus,
    errorMessage?: string
  ): Promise<void> {
    const jobRepo = this.etlDb.getRepository(MigrationJob);
    const job = await jobRepo.findOne({ where: { id: migrationId } });
    if (job) {
      job.status = status;
      job.completedAt = new Date();
      if (errorMessage) {
        job.errorMessage = errorMessage;
      }
      await jobRepo.save(job);
    }
  }

  private reorderEntities(entities: EntityType[]): EntityType[] {
    const requestedTypes = new Set<string>(entities);
    const ordered = ENTITY_DEPENDENCY_ORDER.filter((type) => requestedTypes.has(type));
    return ordered as EntityType[];
  }

  private async copyS3FilesForMedias(migrationId: string): Promise<void> {
    this.logger.info('Starting S3 file copy for medias', { migrationId });

    const medias = await this.mappingRepository.getUncopiedMedias(migrationId);
    this.logger.info('Found medias to copy', { migrationId, count: medias.length });

    let copied = 0;
    let failed = 0;

    const CONCURRENCY_LIMIT = 50;

    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

    const mediaChunks = chunkArray(medias, CONCURRENCY_LIMIT);

    for (const chunk of mediaChunks) {
      const promises = chunk.map(async (media) => {
        if (!media.sourceS3Key || !media.destinationS3Key) {
          this.logger.warn('Missing S3 keys for media', {
            migrationId,
            mediaId: media.agentcisMediaId,
            sourceKey: media.sourceS3Key,
            destKey: this.s3BucketConfig.awsBucketTenant + '/' + media.destinationS3Key,
          });
          await this.mappingRepository.updateMediaS3Status(
            media.agentcisMediaId,
            false,
            'Missing S3 keys'
          );
          failed++;
          return;
        }

        try {
          await this.s3CopyService.copyFile({
            sourceBucket: this.s3BucketConfig.awsSourceBucket,
            sourceKey: media.sourceS3Key,
            destinationBucket: this.s3BucketConfig.awsDestinationBucket,
            destinationKey: this.s3BucketConfig.awsBucketTenant + '/' + media.destinationS3Key,
          });

          await this.mappingRepository.updateMediaS3Status(media.agentcisMediaId, true);
          copied++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error('Failed to copy S3 file', {
            migrationId,
            mediaId: media.agentcisMediaId,
            sourceKey: media.sourceS3Key,
            error: errorMessage,
          });
          await this.mappingRepository.updateMediaS3Status(
            media.agentcisMediaId,
            false,
            errorMessage
          );
          failed++;
        }
      });

      await Promise.all(promises);
    }

    this.logger.info('S3 file copy completed', { migrationId, copied, failed });
  }

  async cancel(migrationId?: string): Promise<void> {
    this.isCancelled = true;
    this.logger.info('Migration cancelled', { migrationId });
  }
}
