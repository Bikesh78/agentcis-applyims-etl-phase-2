import { DataSource } from 'typeorm';
import { TempMappedContact } from '../entities/etlDb/temp-mapped-contacts.entity.js';
import { TempMappedApplication } from '../entities/etlDb/temp-mapped-appplication.entity.js';
import { TempMappedDeal } from '../entities/etlDb/temp-mapped-deals.entity.js';
import { TempMappedOfficeVisit } from '../entities/etlDb/temp-mapped-office-visits.entity.js';
import { TempMappedMedia } from '../entities/etlDb/temp-mapped-medias.entity.js';
import { TempMappedContactActivity } from 'entities/etlDb/temp-mapped-contact-activities.entity.js';
import { TempMappedUser } from '../entities/etlDb/temp-mapped-users.entity.js';
import { TempMappedNote } from '../entities/etlDb/temp-mapped-notes.entity.js';
import { TempMappedCheckin } from '../entities/etlDb/temp-mapped-checkins.entity.js';
import { TempMappedWalkinContact } from '../entities/etlDb/temp-mapped-walkin-contacts.entity.js';
import { EntityType } from '../constants/entity-types.js';

export interface BaseMappingData {
  agentcisId: string;
  applyimsId: string;
}

export type ContactMappingData = BaseMappingData;
export type OfficeVisitMappingData = BaseMappingData;
export type ContactActivityMappingData = BaseMappingData;
export type UserMappingData = BaseMappingData;

export interface ApplicationMappingData extends BaseMappingData {
  appIdentifier?: string;
}

export interface MediaMappingData extends BaseMappingData {
  sourceS3Key?: string;
  destinationS3Key?: string;
}

export interface DealMappingData {
  dealId: string;
  contactId?: string;
  branchId?: string;
  clientId?: number;
  applicationId?: number;
  minimumDate?: Date;
  maxDate?: Date;
  dealName?: string;
  userId: string | null;
  serviceId: string | null;
}

export type NoteMappingData = BaseMappingData;
export type CheckinMappingData = BaseMappingData;

export type StoreMappingInput =
  | { entityType: EntityType.CONTACTS; data: ContactMappingData }
  | { entityType: EntityType.APPLICATIONS; data: ApplicationMappingData }
  | { entityType: EntityType.OFFICE_VISITS; data: OfficeVisitMappingData }
  | { entityType: EntityType.ATTACHMENTS; data: MediaMappingData }
  | { entityType: EntityType.CONTACT_ACTIVITIES; data: ContactActivityMappingData }
  | { entityType: EntityType.USERS; data: UserMappingData }
  | { entityType: EntityType.NOTES; data: NoteMappingData }
  | { entityType: EntityType.DEALS; data: BaseMappingData }
  | { entityType: EntityType.AGENTS; data: BaseMappingData }
  | { entityType: EntityType.CHECKINS; data: CheckinMappingData };

export class MappingRepository {
  constructor(private readonly etlDb: DataSource) {}

  async storeMapping(migrationId: string, input: StoreMappingInput): Promise<void> {
    switch (input.entityType) {
      case EntityType.CONTACTS:
        await this.storeContactMapping(migrationId, input.data);
        break;
      case EntityType.APPLICATIONS:
        await this.storeApplicationMapping(migrationId, input.data);
        break;
      case EntityType.OFFICE_VISITS:
        await this.storeOfficeVisitMapping(migrationId, input.data);
        break;
      case EntityType.ATTACHMENTS:
        await this.storeMediaMapping(migrationId, input.data);
        break;
      case EntityType.CONTACT_ACTIVITIES:
        await this.storeContactActivitiesMapping(migrationId, input.data);
        break;
      case EntityType.USERS:
        await this.storeUserMapping(migrationId, input.data);
        break;
      case EntityType.NOTES:
        await this.storeNoteMapping(migrationId, input.data);
        break;
      case EntityType.CHECKINS:
        await this.storeCheckinMapping(migrationId, input.data);
        break;
      case EntityType.DEALS:
      case EntityType.AGENTS:
        break;
      default: {
        const _exhaustive: never = input;
        throw new Error(`Unsupported entity type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  async storeContactMapping(migrationId: string, data: ContactMappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedContact).upsert(
      {
        agentcisContactId: parseInt(data.agentcisId),
        applyimsContactId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisContactId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeContactMappingIfAbsent(migrationId: string, data: ContactMappingData): Promise<void> {
    await this.etlDb
      .getRepository(TempMappedContact)
      .createQueryBuilder()
      .insert()
      .into(TempMappedContact)
      .values({
        agentcisContactId: parseInt(data.agentcisId),
        applyimsContactId: data.applyimsId,
        migrationId,
      })
      .orIgnore() // Postgres ON CONFLICT (agentcis_contact_id) DO NOTHING — never overwrite
      .execute();
  }

  async storeApplicationMapping(migrationId: string, data: ApplicationMappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedApplication).upsert(
      {
        agentcisApplicationId: parseInt(data.agentcisId),
        applyimsApplicationId: data.applyimsId,
        appIdentifier: data.appIdentifier,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisApplicationId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeOfficeVisitMapping(migrationId: string, data: OfficeVisitMappingData): Promise<void> {
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

  async storeMediaMapping(migrationId: string, data: MediaMappingData): Promise<void> {
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

  async storeContactActivitiesMapping(
    migrationId: string,
    data: ContactActivityMappingData
  ): Promise<void> {
    await this.etlDb.getRepository(TempMappedContactActivity).upsert(
      {
        agentcisContactActivityId: parseInt(data.agentcisId),
        applyimsContactActivityId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisContactActivityId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeNoteMapping(migrationId: string, data: NoteMappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedNote).upsert(
      {
        agentcisNoteId: parseInt(data.agentcisId),
        applyimsNoteId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisNoteId'],
        skipUpdateIfNoValuesChanged: true,
      }
    );
  }

  async storeWalkInContactMappingsBatch(
    rows: { email: string; applyimsContactId: string }[],
    migrationId: string
  ): Promise<void> {
    if (rows.length === 0) return;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize).map((r) => ({
        email: r.email,
        applyimsContactId: r.applyimsContactId,
        migrationId,
      }));
      await this.etlDb.getRepository(TempMappedWalkinContact).upsert(slice, {
        conflictPaths: ['email'],
        skipUpdateIfNoValuesChanged: true,
      });
    }
  }

  async storeCheckinMapping(migrationId: string, data: CheckinMappingData): Promise<void> {
    try {
      await this.etlDb.getRepository(TempMappedCheckin).upsert(
        {
          agentcisCheckinUuid: data.agentcisId,
          applyimsOfficeVisitId: data.applyimsId,
          migrationId: migrationId,
        },
        {
          conflictPaths: ['agentcisCheckinUuid'],
          skipUpdateIfNoValuesChanged: true,
        }
      );
    } catch (error) {
      console.log('mapping error', error);
    }
  }

  async storeUserMapping(migrationId: string, data: UserMappingData): Promise<void> {
    await this.etlDb.getRepository(TempMappedUser).upsert(
      {
        agentcisUserId: parseInt(data.agentcisId),
        applyimsUserId: data.applyimsId,
        migrationId: migrationId,
      },
      {
        conflictPaths: ['agentcisUserId'],
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

  async getClientIdByApplication(applicationId: number): Promise<number | null> {
    const result = await this.etlDb.getRepository(TempMappedDeal).findOne({
      where: { applicationId },
      select: ['clientId'],
    });
    return result?.clientId ?? null;
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
        clientId: d.clientId,
        applicationId: d.applicationId,
        minimumDate: d.minimumDate,
        maxDate: d.maxDate,
        dealName: d.dealName ?? '',
        migrationId,
        userId: d.userId,
        serviceId: d.serviceId,
      }));

      await this.etlDb
        .getRepository(TempMappedDeal)
        .createQueryBuilder()
        .insert()
        .into(TempMappedDeal)
        .values(rows)
        .orIgnore()
        .execute();
    }
  }
}
