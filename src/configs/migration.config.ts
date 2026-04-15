import { EntityUnionType } from 'repositories/mapping.repository.js';

export interface MigrationConfig {
  migrationId: string;
  entities: EntityUnionType[];
  dateRange: {
    start: Date;
    end: Date;
  };
  batchSize: number;
  parallelism: number;
}
