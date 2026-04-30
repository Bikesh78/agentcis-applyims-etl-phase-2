import { DataSource } from 'typeorm';
import { TempMappedContact } from '../entities/etlDb/temp-mapped-contacts.entity.js';
import { TempMappedApplication } from '../entities/etlDb/temp-mapped-appplication.entity.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';
import { TempMappedOfficeVisit } from '../entities/etlDb/temp-mapped-office-visits.entity.js';
import { TempMappedMedia } from '../entities/etlDb/temp-mapped-medias.entity.js';

export interface MappingData {
  agentcisId: string;
  applyimsId: string;
  branchId?: string;
  sourceS3Key?: string;
  destinationS3Key?: string;
}

export type EntityUnionType =
  | 'contacts'
  | 'applications'
  | 'deals'
  | 'office-visits'
  | 'attachments'
  | 'agents';

export interface DealMappingData {
  dealId: string;
  contactId?: string;
  branchId?: string;
  applicationId?: number;
  minimumDate?: Date;
  maxDate?: Date;
  dealName?: string;
  userId: string | null;
  serviceId: string | null;
}

export class MappingRepository {
  constructor(private readonly etlDb: DataSource) {}

  async storeMapping(
    migrationId: string,
    entityType: EntityUnionType,
    data: MappingData | DealMappingData
  ): Promise<void> {
    switch (entityType) {
      case 'contacts':
        await this.storeContactMapping(migrationId, data as MappingData);
        break;
      case 'applications':
        await this.storeApplicationMapping(migrationId, data as MappingData);
        break;
      case 'deals':
        break;
      case 'office-visits':
        await this.storeOfficeVisitMapping(migrationId, data as MappingData);
        break;
      case 'attachments':
        await this.storeMediaMapping(migrationId, data as MappingData);
        break;
      case 'agents':
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  async storeContactMapping(migrationId: string, data: MappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedContact).upsert(
      {
        agentcisContactId: parseInt(data.agentcisId),
        applyimsContactId: data.applyimsId,
        branchId: data.branchId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisContactId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeApplicationMapping(migrationId: string, data: MappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedApplication).upsert(
      {
        agentcisApplicationId: parseInt(data.agentcisId),
        applyimsApplicationId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisApplicationId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeOfficeVisitMapping(migrationId: string, data: MappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedOfficeVisit).upsert(
      {
        agentcisOfficeVisitId: parseInt(data.agentcisId),
        applyimsOfficeVisitId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisOfficeVisitId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeMediaMapping(migrationId: string, data: MappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedMedia).upsert(
      {
        agentcisMediaId: parseInt(data.agentcisId),
        applyimsMediaId: data.applyimsId,
        migrationId: migrationId,
        sourceS3Key: data.sourceS3Key,
        destinationS3Key: data.destinationS3Key,
        s3Copied: false,
      },
      {
        conflictPaths: ['agentcisMediaId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async updateMediaS3Status(
    agentcisMediaId: number,
    s3Copied: boolean,
    s3CopyError?: string
  ): Promise<void> {
    await this.etlDb
      .getRepository(TempMappedMedia)
      .update({ agentcisMediaId }, { s3Copied, s3CopyError });
  }

  async updateMediaS3Keys(
    agentcisMediaId: number,
    sourceS3Key: string,
    destinationS3Key: string
  ): Promise<void> {
    await this.etlDb
      .getRepository(TempMappedMedia)
      .update({ agentcisMediaId }, { sourceS3Key, destinationS3Key });
  }

  async getUncopiedMedias(migrationId: string): Promise<TempMappedMedia[]> {
    return this.etlDb.getRepository(TempMappedMedia).find({
      where: { migrationId, s3Copied: false },
    });
  }

  async getAgentcisClientIdFromApplication(applyimsApplicationId: string): Promise<number | null> {
    const result = await this.etlDb.getRepository(TempMappedApplication).findOne({
      where: { applyimsApplicationId },
      select: ['agentcisClientId'],
    });
    return result?.agentcisClientId ?? null;
  }

  async storeDealStagingBatch(migrationId: string, deals: DealMappingData[]): Promise<void> {
    if (deals.length === 0) {
      return;
    }

    const batchSize = 500;
    for (let i = 0; i < deals.length; i += batchSize) {
      const batch = deals.slice(i, i + batchSize);
      const rows = batch.map((d) => ({
        dealId: d.dealId,
        contactId: d.contactId,
        branchId: d.branchId,
        applicationId: d.applicationId,
        minimumDate: d.minimumDate,
        maxDate: d.maxDate,
        dealName: d.dealName ?? '',
        migrationId,
        userId: d.userId,
        serviceId: d.serviceId,
      }));

      await this.etlDb.getRepository(TempMappedDeal).upsert(rows, {
        conflictPaths: ['contactId', 'applicationId'],
        skipUpdateIfNoValuesChanged: true,
      });
    }
  }
}
