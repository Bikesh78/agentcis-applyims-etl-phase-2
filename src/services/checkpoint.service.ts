import { DataSource } from 'typeorm';
import { MigrationCheckpoint } from '../entities/etlDb/migration-checkpoints.entity.js';
import { Logger } from '../utils/logger.js';

export interface CheckpointData {
  migrationId: string;
  entityType: string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  lastProcessedId?: string;
  startedAt: Date;
  completedAt?: Date;
}

export class CheckpointService {
  constructor(
    private dataSource: DataSource,
    private logger: Logger
  ) {}

  async createCheckpoint(data: CheckpointData): Promise<void> {
    await this.dataSource.getRepository(MigrationCheckpoint).save({
      migrationId: data.migrationId,
      entityType: data.entityType,
      totalCount: data.totalCount,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: data.startedAt,
    });

    this.logger.info(`Checkpoint created for ${data.entityType}`, {
      migrationId: data.migrationId,
      totalCount: data.totalCount,
    });
  }

  async updateCheckpoint(
    migrationId: string,
    entityType: string,
    update: Partial<CheckpointData>
  ): Promise<void> {
    const checkpoint = await this.dataSource.getRepository(MigrationCheckpoint).findOne({
      where: { migrationId, entityType },
    });

    if (!checkpoint) {
      throw new Error(`Checkpoint not found for ${entityType}`);
    }

    checkpoint.processedCount = update.processedCount ?? checkpoint.processedCount;
    checkpoint.successCount = update.successCount ?? checkpoint.successCount;
    checkpoint.failedCount = update.failedCount ?? checkpoint.failedCount;
    checkpoint.lastProcessedId = update.lastProcessedId ?? checkpoint.lastProcessedId;
    checkpoint.completedAt = update.completedAt;

    await this.dataSource.getRepository(MigrationCheckpoint).save(checkpoint);

    this.logger.debug(`Checkpoint updated for ${entityType}`, {
      migrationId,
      processedCount: checkpoint.processedCount,
      successCount: checkpoint.successCount,
      failedCount: checkpoint.failedCount,
    });
  }

  async getCheckpoint(migrationId: string, entityType: string): Promise<CheckpointData | null> {
    const result = await this.dataSource.getRepository(MigrationCheckpoint).findOne({
      where: { migrationId, entityType },
    });

    if (!result) return null;

    return {
      migrationId: result.migrationId,
      entityType: result.entityType,
      totalCount: result.totalCount ?? 0,
      processedCount: result.processedCount ?? 0,
      successCount: result.successCount ?? 0,
      failedCount: result.failedCount ?? 0,
      lastProcessedId: result.lastProcessedId,
      startedAt: result.startedAt!,
      completedAt: result.completedAt ?? undefined,
    };
  }

  async calculateETA(migrationId: string, entityType: string): Promise<Date | null> {
    const checkpoint = await this.getCheckpoint(migrationId, entityType);
    if (!checkpoint || checkpoint.processedCount === 0) return null;

    const elapsed = Date.now() - checkpoint.startedAt.getTime();
    const rate = checkpoint.processedCount / elapsed;
    const remaining = checkpoint.totalCount - checkpoint.processedCount;

    if (rate === 0) return null;

    const estimatedRemaining = remaining / rate;
    return new Date(Date.now() + estimatedRemaining);
  }

  async getProgress(
    migrationId: string,
    entityType: string
  ): Promise<{ percentage: number; processed: number; total: number } | null> {
    const checkpoint = await this.getCheckpoint(migrationId, entityType);
    if (!checkpoint || checkpoint.totalCount === 0) return null;

    const percentage = (checkpoint.processedCount / checkpoint.totalCount) * 100;

    return {
      percentage: Math.round(percentage * 100) / 100,
      processed: checkpoint.processedCount,
      total: checkpoint.totalCount,
    };
  }

  async getAllCheckpoints(migrationId: string): Promise<CheckpointData[]> {
    const checkpoints = await this.dataSource.getRepository(MigrationCheckpoint).find({
      where: { migrationId },
    });

    return checkpoints.map((cp) => ({
      migrationId: cp.migrationId,
      entityType: cp.entityType,
      totalCount: cp.totalCount ?? 0,
      processedCount: cp.processedCount ?? 0,
      successCount: cp.successCount ?? 0,
      failedCount: cp.failedCount ?? 0,
      lastProcessedId: cp.lastProcessedId,
      startedAt: cp.startedAt!,
      completedAt: cp.completedAt ?? undefined,
    }));
  }
}
