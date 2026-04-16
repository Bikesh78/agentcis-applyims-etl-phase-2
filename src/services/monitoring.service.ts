import { DataSource } from 'typeorm';
import { MigrationJob, MigrationStatus } from '../entities/etlDb/migration-jobs.entity.js';
import { MigrationCheckpoint } from '../entities/etlDb/migration-checkpoints.entity.js';
import { MigrationError } from '../entities/etlDb/migration-errors.entity.js';

export interface DashboardCurrentMigration {
  id: string;
  status: string;
  currentEntity: string | null;
  progress: number;
}

export interface DashboardPerformance {
  recordsPerSecond: number;
  apiCallsPerSecond: number;
  averageResponseTime: number;
}

export interface DashboardError {
  entity: string;
  recordId: string;
  error: string;
  timestamp: string;
}

export interface DashboardErrors {
  total: number;
  recent: DashboardError[];
}

export interface DashboardResponse {
  currentMigration: DashboardCurrentMigration | null;
  performance: DashboardPerformance;
  errors: DashboardErrors;
}

export class MonitoringService {
  constructor(private etlDb: DataSource) {}

  async getLatestMigration(): Promise<MigrationJob | null> {
    const job = await this.etlDb.getRepository(MigrationJob).findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
    return job;
  }

  async getDashboardData(migrationId: string): Promise<DashboardResponse> {
    const migration = await this.getCurrentMigration(migrationId);
    const performance = await this.calculatePerformance(migrationId);
    const errors = await this.getErrors(migrationId);

    return {
      currentMigration: migration,
      performance,
      errors,
    };
  }

  async getCurrentMigration(migrationId: string): Promise<DashboardCurrentMigration | null> {
    const job = await this.etlDb.getRepository(MigrationJob).findOne({
      where: { id: migrationId },
    });

    if (!job) return null;

    let currentEntity: string | null = null;
    let progress = 0;

    if (job.status === MigrationStatus.IN_PROGRESS || job.status === MigrationStatus.PAUSED) {
      const checkpoints = await this.etlDb.getRepository(MigrationCheckpoint).find({
        where: { migrationId },
      });

      if (checkpoints.length > 0) {
        const activeCheckpoint = checkpoints.find((cp) => !cp.completedAt) ?? checkpoints[0];
        currentEntity = activeCheckpoint.entityType;

        if (
          activeCheckpoint.totalCount &&
          activeCheckpoint.totalCount > 0 &&
          (activeCheckpoint.processedCount ?? 0) > 0
        ) {
          progress =
            Math.round(
              ((activeCheckpoint.processedCount ?? 0) / activeCheckpoint.totalCount) * 100 * 100
            ) / 100;
        }
      }
    }

    return {
      id: job.id,
      status: job.status,
      currentEntity,
      progress,
    };
  }

  async calculatePerformance(migrationId: string): Promise<DashboardPerformance> {
    const job = await this.etlDb.getRepository(MigrationJob).findOne({
      where: { id: migrationId },
    });

    if (!job || !job.startedAt) {
      return {
        recordsPerSecond: 0,
        apiCallsPerSecond: 0,
        averageResponseTime: 0,
      };
    }

    const checkpoints = await this.etlDb.getRepository(MigrationCheckpoint).find({
      where: { migrationId },
    });

    let totalProcessed = 0;
    let totalSuccess = 0;

    for (const cp of checkpoints) {
      totalProcessed += cp.processedCount ?? 0;
      totalSuccess += cp.successCount ?? 0;
    }

    const elapsedMs = job.completedAt
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : Date.now() - job.startedAt.getTime();

    const elapsedSeconds = Math.max(elapsedMs / 1000, 1);

    const recordsPerSecond = Math.round(totalProcessed / elapsedSeconds);
    const apiCallsPerSecond = Math.round(totalSuccess / elapsedSeconds);

    return {
      recordsPerSecond,
      apiCallsPerSecond,
      averageResponseTime: 0,
    };
  }

  async getErrors(migrationId: string): Promise<DashboardErrors> {
    const errorRepo = this.etlDb.getRepository(MigrationError);

    const total = await errorRepo.count({
      where: { migrationId },
    });

    const recentErrors = await errorRepo.find({
      where: { migrationId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const recent = recentErrors.map((err) => ({
      entity: err.entityType,
      recordId: err.entityId ?? 'unknown',
      error: err.errorMessage ?? 'Unknown error',
      timestamp: err.createdAt.toISOString(),
    }));

    return {
      total,
      recent,
    };
  }
}
