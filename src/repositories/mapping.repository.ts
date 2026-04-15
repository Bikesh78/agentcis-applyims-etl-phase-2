import { DataSource } from 'typeorm';
import { TempMappedContact } from '../entities/etlDb/temp-mapped-contacts.entity.js';
import { TempMappedApplication } from '../entities/etlDb/temp-mapped-appplication.entity.js';

export interface MappingData {
  agentcisId: string;
  applyimsId: string;
  dealId?: string;
  branchId?: string;
}

export type EntityUnionType = 'contacts' | 'applications' | 'deals';

export class MappingRepository {
  constructor(private readonly etlDb: DataSource) {}

  async storeMapping(
    migrationId: string,
    entityType: EntityUnionType,
    data: MappingData
  ): Promise<void> {
    switch (entityType) {
      case 'contacts':
        await this.storeContactMapping(migrationId, data);
        break;
      case 'applications':
        await this.storeApplicationMapping(migrationId, data);
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
        dealId: data.dealId,
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

  async getContactMapping(agentcisId: number): Promise<string | null> {
    const result = await this.etlDb.getRepository(TempMappedContact).findOne({
      where: { agentcisContactId: agentcisId },
      select: ['applyimsContactId'],
    });
    return result?.applyimsContactId ?? null;
  }

  async storeBatchMappings(
    entityType: EntityUnionType,
    migrationId: string,
    mappings: MappingData[]
  ): Promise<void> {
    const data = mappings.map((m) => this.formatMappingData(entityType, migrationId, m));

    switch (entityType) {
      case 'contacts':
        await this.etlDb.getRepository(TempMappedContact).upsert(data, {
          conflictPaths: ['agentcisContactId'],
          skipUpdateIfNoValuesChanged: true,
        });
        break;
      case 'applications':
        await this.etlDb.getRepository(TempMappedApplication).upsert(data, {
          conflictPaths: ['agentcisApplicationId'],
          skipUpdateIfNoValuesChanged: true,
        });
        break;
      case 'deals':
        throw new Error('Deal mapping batch insert not implemented');
    }
  }

  private getTableName(entityType: EntityUnionType): string {
    const tableMap: Record<string, string> = {
      contacts: 'temp_mapped_contacts',
      applications: 'temp_mapped_applications',
      deals: 'temp_mapped_deals',
    };
    return tableMap[entityType];
  }

  private formatMappingData(
    entityType: EntityUnionType,
    migrationId: string,
    data: MappingData
  ): Partial<TempMappedContact | TempMappedApplication> {
    switch (entityType) {
      case 'contacts':
        return {
          agentcisContactId: parseInt(data.agentcisId),
          applyimsContactId: data.applyimsId,
          dealId: data.dealId,
          branchId: data.branchId,
          migrationId: migrationId,
        };
      case 'applications':
        return {
          agentcisApplicationId: parseInt(data.agentcisId),
          applyimsApplicationId: data.applyimsId,
          migrationId: migrationId,
        };
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  async getMapping(entityType: string, agentcisId: string | number): Promise<string | null> {
    switch (entityType) {
      case 'contacts':
        return this.getContactMapping(
          typeof agentcisId === 'string' ? parseInt(agentcisId) : agentcisId
        );
      case 'applications':
        return this.getApplicationMapping(
          typeof agentcisId === 'string' ? parseInt(agentcisId) : agentcisId
        );
      default:
        return null;
    }
  }

  private async getApplicationMapping(agentcisId: number): Promise<string | null> {
    const result = await this.etlDb.getRepository(TempMappedApplication).findOne({
      where: { agentcisApplicationId: agentcisId },
      select: ['applyimsApplicationId'],
    });
    return result?.applyimsApplicationId ?? null;
  }

  async getAgentcisClientIdFromApplication(applyimsApplicationId: string): Promise<number | null> {
    const result = await this.etlDb.getRepository(TempMappedApplication).findOne({
      where: { applyimsApplicationId },
      select: ['agentcisClientId'],
    });
    return result?.agentcisClientId ?? null;
  }
}
