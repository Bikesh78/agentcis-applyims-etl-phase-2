import { EntityType } from '../constants/entity-types.js';

export interface MigrationConfig {
  migrationId: string;
  originalMigrationId?: string;
  entities: EntityType[];
  dateRange: {
    start: Date;
    end: Date;
  };
  batchSize: number;
  parallelism: number;
  resumeFrom?: {
    checkpointId: string;
  };
}
