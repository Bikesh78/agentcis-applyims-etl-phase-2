import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import { BaseExtractor, ExtractorConfig } from '../extractors/base.extractor.js';
import { ContactExtractor } from '../extractors/contact.extractor.js';
import { ApplicationExtractor } from '../extractors/application.extractor.js';
import { DealExtractor } from '../extractors/deal.extractor.js';
import {
  OfficeVisitExtractor,
  OfficeVisitWithNotes,
} from '../extractors/office-visit.extractor.js';
import { CheckinExtractor, CheckinWithContext } from '../extractors/checkin.extractor.js';
import { CheckinTransformer } from '../transformers/checkin.transformer.js';
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
import {
  ErrorRecoveryManager,
  ErrorCategory,
  SkipByDesignError,
} from '../loaders/error-recovery.js';
import { ApplyIMSApiClient, BulkResponse } from '../loaders/api-client.js';
import { Logger } from '../utils/logger.js';
import { MigrationJob, MigrationStatus } from '../entities/etlDb/migration-jobs.entity.js';
import { MigrationConfig } from '../configs/migration.config.js';
import {
  EntityType,
  ENTITY_API_METHOD_MAP,
  ENTITY_DEPENDENCY_ORDER,
  SUPPORTED_ENTITIES,
} from '../constants/entity-types.js';
import { Clients } from '../entities/agentcis/clients.entity.js';
import { Applications } from '../entities/agentcis/applications.entity.js';
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
import { v5 as uuidv5 } from 'uuid';
import { MIGRATION_NAMESPACE } from 'constants/uuid-namespace.js';

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
  | OfficeVisitWithNotes
  | CheckinWithContext
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
        if (result.successful > result.total) {
          this.logger.warn('Entity completion counter anomaly: successful exceeds total', {
            migrationId,
            entityType,
            successful: result.successful,
            total: result.total,
          });
        }
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

        // if (entityType === EntityType.ATTACHMENTS) {
        //   await this.copyS3FilesForMedias(config.migrationId);
        // }
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
    entityStartTime: number,
    extractorConfigOverride?: ExtractorConfig
  ): Promise<EntityMigrationResult> {
    const { migrationId } = config;
    this.logger.info('Starting entity migration', { migrationId, entityType });

    let extractorConfig: ExtractorConfig;
    if (extractorConfigOverride) {
      extractorConfig = extractorConfigOverride;
    } else {
      let lastProcessedId: number | null = null;
      if (config.resumeFrom?.checkpointId) {
        const checkpoint = await this.checkpointService.getCheckpoint(migrationId, entityType);
        if (checkpoint && checkpoint.lastProcessedId && !checkpoint.completedAt) {
          lastProcessedId = parseInt(checkpoint.lastProcessedId, 10);
        }
      }
      extractorConfig = {
        batchSize: config.batchSize,
        startDate: config.dateRange.start,
        endDate: config.dateRange.end,
        checkpointId: config.resumeFrom?.checkpointId,
        lastProcessedId,
      };
    }

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

    const concurrency = config.concurrency ?? 1;
    const limit = pLimit(concurrency);
    const batchResults = new Map<
      number,
      { result: ProcessResult; batch: SourceEntity[]; transformedLength: number }
    >();
    let nextCheckpointBatchIndex = 0;
    let batchIndex = 0;

    const processBatchAndQueue = async (
      transformed: TargetEntity[],
      batch: SourceEntity[],
      index: number,
      transformedLength: number
    ): Promise<void> => {
      const batchStartTime = Date.now();
      const result = await this.batchProcessor.processBatch(
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

      batchResults.set(index, { result, batch, transformedLength });

      while (batchResults.has(nextCheckpointBatchIndex)) {
        const {
          result: batchResult,
          batch: batchData,
          transformedLength: txLen,
        } = batchResults.get(nextCheckpointBatchIndex)!;
        batchResults.delete(nextCheckpointBatchIndex);

        successCount += batchResult.successful;
        failedCount += batchResult.failed;
        skippedCount += batchResult.skipped;

        if (txLen < batchData.length) {
          processedCount += batchData.length;
        } else {
          processedCount += txLen;
        }

        await this.checkpointService.updateCheckpoint(migrationId, entityType, {
          processedCount,
          successCount,
          failedCount,
          lastProcessedId: String(batchData[batchData.length - 1]?.id ?? ''),
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
          successful: batchResult.successful,
          failed: batchResult.failed,
          skipped: batchResult.skipped,
        });

        nextCheckpointBatchIndex++;
      }
    };

    const promises: Array<Promise<void>> = [];

    for await (const batch of handlers.extractor.extractAll()) {
      if (this.isCancelled) break;

      const transformed: TargetEntity[] = [];
      let batchTransformSkipped = 0;
      let batchTransformFailed = 0;
      const transformResults = await Promise.allSettled(
        batch.map((item) => handlers.transformer.transform(item))
      );

      for (let i = 0; i < transformResults.length; i++) {
        const result = transformResults[i];
        if (result.status === 'fulfilled' && result.value !== null) {
          transformed.push(result.value);
        } else if (result.status === 'fulfilled' && result.value === null) {
          batchTransformSkipped++;
          skippedCount++;
        } else if (result.status === 'rejected') {
          const error =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          if (error instanceof SkipByDesignError) {
            this.logger.warn('Transform skipped by design', {
              migrationId,
              entityType,
              itemId: String(batch[i]?.id ?? 'unknown'),
              reason: error.message,
            });
            await this.errorRecoveryManager.logError(
              migrationId,
              entityType,
              String(batch[i]?.id ?? 'unknown'),
              error,
              ErrorCategory.SKIP_BY_DESIGN,
              { payload: batch[i] }
            );
            batchTransformSkipped++;
            skippedCount++;
          } else {
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
            batchTransformFailed++;
            skippedCount++;
          }
        }
      }

      if (transformed.length === 0) {
        processedCount += batch.length;
        if (batchTransformFailed === 0) {
          this.logger.info('All items in batch skipped (transformer returned null)', {
            migrationId,
            entityType,
            batchSize: batch.length,
            transformSkipped: batchTransformSkipped,
          });
        } else if (batchTransformSkipped === 0) {
          this.logger.warn('All transforms failed for batch', {
            migrationId,
            entityType,
            batchSize: batch.length,
            transformFailed: batchTransformFailed,
          });
        } else {
          this.logger.warn('All items in batch skipped or failed', {
            migrationId,
            entityType,
            batchSize: batch.length,
            transformSkipped: batchTransformSkipped,
            transformFailed: batchTransformFailed,
          });
        }
        skippedCount += batch.length;
        continue;
      }

      const currentBatchIndex = batchIndex++;
      const promise = limit(() =>
        processBatchAndQueue(transformed, batch, currentBatchIndex, transformed.length)
      );
      promises.push(promise);
    }

    await Promise.all(promises);

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
              transformer.transform(item as OfficeVisitWithNotes) as Promise<ApplyIMSOfficeVisit>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateOfficeVisits(batch as ApplyIMSOfficeVisit[]),
        };
      }
      case EntityType.CHECKINS: {
        const extractor = new CheckinExtractor(this.agentcisDb, this.etlDb, config);
        const transformer = new CheckinTransformer(this.createIdResolver());
        return {
          extractor: extractor as unknown as BaseExtractor<SourceEntity>,
          transformer: {
            transform: (item) =>
              transformer.transform(item as CheckinWithContext) as Promise<ApplyIMSOfficeVisit>,
          },
          apiMethod: (batch) =>
            this.apiClient.bulkCreateOfficeVisits(batch as ApplyIMSOfficeVisit[]),
        };
      }
      case EntityType.ATTACHMENTS: {
        const extractor = new AttachmentExtractor(this.agentcisDb, config);
        const transformer = AttachmentTransformer.create(
          this.createIdResolver(),
          this.etlDb,
          this.agentcisDb
        );
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
      select: ['agentcisContactId'],
    });

    if (migratedContacts.length === 0) {
      this.logger.warn('No migrated contacts found for deal staging', { migrationId });
      return;
    }

    const priorMigratedContactIds = await this.loadPriorMigratedContactIds();
    const migratedClientIds = Array.from(
      new Set([...migratedContacts.map((c) => c.agentcisContactId), ...priorMigratedContactIds])
    );
    this.logger.info('Deal staging client scope', {
      migrationId,
      thisRunContacts: migratedContacts.length,
      priorMigratedContacts: priorMigratedContactIds.length,
      totalClientIds: migratedClientIds.length,
    });

    const priorMigratedAppIds = await this.loadPriorMigratedApplicationIds();

    const etlMigratedApps: { agentcis_application_id: number }[] = await this.etlDb.query(
      `SELECT agentcis_application_id FROM temp_mapped_applications`
    );
    const etlMigratedAppIds = etlMigratedApps.map((r) => r.agentcis_application_id);

    const allExcludedAppIds = [...new Set([...priorMigratedAppIds, ...etlMigratedAppIds])];

    this.logger.info('Excluding prior-migrated and ETL-migrated applications from deal staging', {
      migrationId,
      priorMigratedCount: priorMigratedAppIds.length,
      etlMigratedCount: etlMigratedAppIds.length,
      totalExcluded: allExcludedAppIds.length,
    });

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
        const qb = subQuery
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

        if (allExcludedAppIds.length > 0) {
          qb.andWhere('app.id NOT IN (:...priorAppIds)', {
            priorAppIds: allExcludedAppIds,
          });
        }

        return qb;
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

      const dealName = this.generateDealName(startDate, endDate);
      const uuidValue = `deal:${app.clientId}-${dealName}`;
      const dealId = uuidv5(uuidValue, MIGRATION_NAMESPACE);
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
          dealName,
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

  private priorMigratedAppIdsCache: number[] | null = null;

  private async loadPriorMigratedApplicationIds(): Promise<number[]> {
    if (this.priorMigratedAppIdsCache !== null) {
      return this.priorMigratedAppIdsCache;
    }
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.resolve(here, '../mapper/applications.json');
      const raw = await readFile(jsonPath, 'utf-8');
      const rows: Array<{ agentcis_id: number }> = JSON.parse(raw);
      this.priorMigratedAppIdsCache = rows
        .map((r) => r.agentcis_id)
        .filter((id): id is number => typeof id === 'number');
      return this.priorMigratedAppIdsCache;
    } catch (err) {
      this.logger.warn('Failed to load prior application ids from applications.json', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.priorMigratedAppIdsCache = [];
      return this.priorMigratedAppIdsCache;
    }
  }

  private priorMigratedContactIdsCache: number[] | null = null;

  private async loadPriorMigratedContactIds(): Promise<number[]> {
    if (this.priorMigratedContactIdsCache !== null) {
      return this.priorMigratedContactIdsCache;
    }
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.resolve(here, '../mapper/contacts.json');
      const raw = await readFile(jsonPath, 'utf-8');
      const rows: Array<{ agentcis_id: number }> = JSON.parse(raw);
      this.priorMigratedContactIdsCache = rows
        .map((r) => r.agentcis_id)
        .filter((id): id is number => typeof id === 'number');
      return this.priorMigratedContactIdsCache;
    } catch (err) {
      this.logger.warn('Failed to load prior contact ids from contacts.json', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.priorMigratedContactIdsCache = [];
      return this.priorMigratedContactIdsCache;
    }
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

  async retryFailedEntities(
    originalMigrationId: string,
    entityTypes: EntityType[]
  ): Promise<string> {
    const RETRY_BATCH_SIZE = 250;
    const retryMigrationId = crypto.randomUUID();

    const jobRepo = this.etlDb.getRepository(MigrationJob);
    const job = jobRepo.create({
      id: retryMigrationId,
      status: MigrationStatus.IN_PROGRESS,
      config: { originalMigrationId, entityTypes },
      startedAt: new Date(),
    });
    await jobRepo.save(job);

    (async () => {
      await this.validateCredentials();
      for (const entityType of entityTypes) {
        if (entityType === EntityType.DEALS) {
          const stagingRows: { migration_id: string }[] = await this.etlDb.query(
            `SELECT td.migration_id
             FROM temp_mapped_deals td
             LEFT JOIN migration_jobs mj ON mj.id = td.migration_id
             WHERE td.migration_id = $1
                OR mj.config->>'originalMigrationId' = $1
             GROUP BY td.migration_id
             ORDER BY MAX(td.id) DESC
             LIMIT 1`,
            [originalMigrationId]
          );

          const dealsMigrationId = stagingRows[0]?.migration_id ?? retryMigrationId;

          this.logger.info('Running deal migration for retry-staged deals', {
            retryMigrationId,
            dealsMigrationId,
          });

          await this.migrateEntity(
            {
              migrationId: dealsMigrationId,
              entities: [EntityType.DEALS],
              dateRange: { start: new Date(0), end: new Date() },
              batchSize: RETRY_BATCH_SIZE,
              parallelism: 1,
            },
            EntityType.DEALS,
            Date.now()
          );
          continue;
        }

        const rows: { entity_id: string; source_data?: any }[] = await this.etlDb.query(
          `SELECT DISTINCT entity_id, source_data
           FROM migration_errors
           WHERE migration_id = $1
             AND entity_type = $2
             AND error_code NOT IN ('VALIDATION_ERROR', 'SKIP_BY_DESIGN')`,
          [originalMigrationId, entityType]
        );

        // Handle both integer entity_ids and UUID entity_ids (timeout batch errors)
        const targetIds: number[] = [];
        for (const row of rows) {
          const intId = parseInt(row.entity_id, 10);
          if (!isNaN(intId)) {
            // Integer ID: use directly (actual agentcis record ID)
            targetIds.push(intId);
          } else if (row.source_data?.chunk && Array.isArray(row.source_data.chunk)) {
            // UUID ID: likely a timeout batch error, extract actual record IDs from chunk
            for (const record of row.source_data.chunk) {
              // Map entity types to their ID field names
              let id: number | undefined;
              switch (entityType) {
                case EntityType.APPLICATIONS:
                  id = record.agentcisApplicationId;
                  break;
                case EntityType.NOTES:
                  id = record.agentcisId;
                  break;
                case EntityType.CONTACT_ACTIVITIES:
                  id = record.agentcisActivityId;
                  break;
                case EntityType.ATTACHMENTS:
                  id = record.agentcisInternalId;
                  break;
                default:
                  id = record.agentcisId ?? record.agentcisApplicationId;
              }
              if (id && !isNaN(id)) {
                targetIds.push(id);
              }
            }
          }
        }
        console.log('targetIds', targetIds);

        if (targetIds.length === 0) {
          this.logger.info('No retryable failures found', { retryMigrationId, entityType });
        } else {
          this.logger.info('Retrying failed entity records', {
            retryMigrationId,
            originalMigrationId,
            entityType,
            count: targetIds.length,
          });

          const extractorConfig: ExtractorConfig = {
            batchSize: RETRY_BATCH_SIZE,
            startDate: new Date(0),
            endDate: new Date(),
            targetIds,
          };

          await this.migrateEntity(
            {
              migrationId: retryMigrationId,
              originalMigrationId,
              entities: [entityType],
              dateRange: { start: new Date(0), end: new Date() },
              batchSize: RETRY_BATCH_SIZE,
              parallelism: 1,
            },
            entityType,
            Date.now(),
            extractorConfig
          );
        }

        if (entityType === EntityType.ATTACHMENTS) {
          this.logger.info('Running S3 copy for attachment retry', { retryMigrationId });
          await this.copyS3FilesForMedias(retryMigrationId);
        }

        if (entityType === EntityType.CONTACTS) {
          this.logger.info('Running deal staging after contacts retry', { retryMigrationId });
          await this.populateDealStaging({
            migrationId: retryMigrationId,
            originalMigrationId,
            entities: [EntityType.CONTACTS],
            dateRange: { start: new Date(0), end: new Date() },
            batchSize: 100,
            parallelism: 1,
          });
        }

        // Batch-level chunk retry (timeouts, ENOTFOUND) with stored source_data.chunk
        const batchErrors: { id: number; source_data: { chunk: any[] } }[] = await this.etlDb.query(
          `SELECT id, source_data
             FROM migration_errors
             WHERE migration_id = $1
               AND entity_type = $2
               AND error_code = 'API_ERROR'
               AND source_data ? 'chunk'`,
          [originalMigrationId, entityType]
        );

        if (batchErrors.length > 0) {
          const totalChunkApps = batchErrors.reduce(
            (sum, r) => sum + (r.source_data.chunk?.length ?? 0),
            0
          );
          this.logger.info('Retrying batch-level API errors with stored chunks', {
            retryMigrationId,
            entityType,
            batchCount: batchErrors.length,
            totalChunkApps,
          });

          const apiMethodName = ENTITY_API_METHOD_MAP[entityType];
          if (apiMethodName) {
            const apiMethod = (batch: any[]) => (this.apiClient as any)[apiMethodName](batch);
            const subBatchSize = RETRY_BATCH_SIZE;

            // Pre-load already-mapped IDs to skip them
            const alreadyMapped: { agentcis_application_id: number }[] = await this.etlDb.query(
              `SELECT agentcis_application_id FROM temp_mapped_applications`
            );
            const alreadyMappedSet = new Set(alreadyMapped.map((r) => r.agentcis_application_id));

            // Create checkpoint if not yet created for this retry run
            const existingCp = await this.checkpointService.getCheckpoint(
              retryMigrationId,
              entityType
            );
            const filteredTotal = batchErrors.reduce(
              (sum, r) =>
                sum +
                (r.source_data.chunk?.filter(
                  (item: any) => !alreadyMappedSet.has(item.agentcisApplicationId)
                ).length ?? 0),
              0
            );
            if (!existingCp) {
              await this.checkpointService.createCheckpoint({
                migrationId: retryMigrationId,
                entityType,
                totalCount: filteredTotal,
                processedCount: 0,
                successCount: 0,
                failedCount: 0,
                startedAt: new Date(),
              });
            }

            // Seed from existing checkpoint so chunk values ADD to targetIds path values
            let chunkProcessed = existingCp?.processedCount ?? 0;
            let chunkSuccess = existingCp?.successCount ?? 0;
            let chunkFailed = existingCp?.failedCount ?? 0;

            for (const errorRow of batchErrors) {
              const chunk = (errorRow.source_data.chunk ?? []).filter(
                (item: any) => !alreadyMappedSet.has(item.agentcisApplicationId)
              );
              if (chunk.length === 0) continue;

              for (let i = 0; i < chunk.length; i += subBatchSize) {
                const subBatch = chunk.slice(i, i + subBatchSize);
                const result = await this.batchProcessor.processBatch(
                  subBatch as any,
                  entityType,
                  apiMethod,
                  retryMigrationId,
                  subBatchSize
                );
                chunkProcessed += subBatch.length;
                chunkSuccess += result.successful;
                chunkFailed += result.failed;

                await this.checkpointService.updateCheckpoint(retryMigrationId, entityType, {
                  processedCount: chunkProcessed,
                  successCount: chunkSuccess,
                  failedCount: chunkFailed,
                  lastProcessedId: String(errorRow.id),
                });
              }
            }

            this.logger.info('Chunk retry completed', {
              retryMigrationId,
              entityType,
              successCount: chunkSuccess,
              failedCount: chunkFailed,
            });
          }
        }
      }

      await this.updateMigrationJob(retryMigrationId, MigrationStatus.COMPLETED);
      this.logger.info('Retry migration completed', { retryMigrationId, originalMigrationId });
    })().catch(async (err) => {
      this.logger.error('Retry migration failed', { retryMigrationId, error: String(err) });
      await this.updateMigrationJob(retryMigrationId, MigrationStatus.FAILED, String(err));
    });

    return retryMigrationId;
  }

  async cancel(migrationId?: string): Promise<void> {
    this.isCancelled = true;
    this.logger.info('Migration cancelled', { migrationId });
  }
}
