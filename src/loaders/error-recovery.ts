import { DataSource } from 'typeorm';
import { MigrationError } from '../entities/etlDb/migration-errors.entity.js';
import { Logger } from '../utils/logger.js';

export enum ErrorCategory {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  TRANSFORMATION_ERROR = 'TRANSFORMATION_ERROR',
}

export class ErrorRecoveryManager {
  constructor(
    private dataSource: DataSource,
    private logger: Logger
  ) {}

  async logError(
    migrationId: string,
    entityType: string,
    entityId: string,
    error: Error,
    category: ErrorCategory,
    sourceData?: any
  ): Promise<void> {
    console.log('logger called');
    await this.dataSource.getRepository(MigrationError).save({
      migrationId,
      entityType,
      entityId,
      errorCode: category,
      errorMessage: error.message,
      errorDetails: {
        stack: error.stack,
        category,
      },
      sourceData: sourceData ? sourceData : undefined,
    });
    console.log('error', error);

    this.logger.error('Migration error logged', {
      migrationId,
      entityType,
      entityId,
      category,
      message: error.message,
    });
  }

  isRetryable(category: ErrorCategory): boolean {
    return [ErrorCategory.NETWORK_ERROR, ErrorCategory.API_ERROR].includes(category);
  }

  isSkippable(category: ErrorCategory): boolean {
    return [ErrorCategory.VALIDATION_ERROR, ErrorCategory.TRANSFORMATION_ERROR].includes(category);
  }

  async getErrorStats(migrationId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
  }> {
    const errors = await this.dataSource.getRepository(MigrationError).find({
      where: { migrationId },
      select: ['errorCode'],
    });

    const byCategory: Record<string, number> = {};
    errors.forEach((e) => {
      const category = e.errorCode ?? 'UNKNOWN';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
      total: errors.length,
      byCategory,
    };
  }
}
