export interface MigrationConfig {
  migrationId: string;
  entities: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  batchSize: number;
  parallelism: number;
}
