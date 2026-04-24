import pLimit from 'p-limit';
import { ApplyIMSApiClient, BulkResponse } from './api-client.js';
import { MappingRepository, EntityUnionType } from '../repositories/mapping.repository.js';
import { ErrorRecoveryManager, ErrorCategory } from './error-recovery.js';
import { Logger } from '../utils/logger.js';

export interface ProcessResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    entityId: number | string;
    error: string;
    code: string | number;
    entityType: string;
  }>;
}

export class BatchProcessor {
  constructor(
    private apiClient: ApplyIMSApiClient,
    private mappingRepository: MappingRepository,
    private errorRecoveryManager: ErrorRecoveryManager,
    private logger: Logger,
    private batchSize: number = 100
  ) {}

  async processBatch<T extends { agentcisClientId: string; id?: string }>(
    items: T[],
    entityType: EntityUnionType,
    apiMethod: (batch: T[]) => Promise<BulkResponse>,
    migrationId: string
  ): Promise<ProcessResult> {
    const results: ProcessResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    this.logger.info(`Processing ${items.length} ${entityType}`, {
      batchSize: this.batchSize,
    });

    try {
      const response = await apiMethod.call(this.apiClient, items);

      const successCount = response.successful?.length ?? 0;
      const failedCount = response.failed?.length ?? 0;

      for (const success of response.successful ?? []) {
        try {
          await this.mappingRepository.storeMapping(migrationId, entityType, {
            agentcisId: success.internalId,
            applyimsId: success.id,
          });
        } catch (err) {
          this.logger.error(`Failed to store mapping for ${entityType}`, {
            error: String(err),
            success,
          });
        }
      }

      results.successful += successCount;
      results.failed += failedCount;

      if (response.failed) {
        results.errors.push(
          ...response.failed.map((f) => ({
            entityType,
            entityId: f.internalId,
            error: f.error,
            code: f.code || 'RECORD_FAILURE',
          }))
        );

        for (const failedRecord of response.failed) {
          const error = new Error(failedRecord.error);
          await this.errorRecoveryManager.logError(
            migrationId,
            entityType,
            String(failedRecord.internalId),
            error,
            ErrorCategory.API_ERROR,
            { failedRecord }
          );
        }
      }

      this.logger.info(`Batch completed for ${entityType}`, {
        successful: successCount,
        failed: failedCount,
        batchSize: items.length,
      });
    } catch (error: any) {
      await this.handleError(error, entityType, items, 0, results, migrationId);
    }

    this.logger.info(`${entityType} processing complete`, {
      totalSuccessful: results.successful,
      totalFailed: results.failed,
      totalSkipped: results.skipped,
    });

    return results;
  }

  async processWithConcurrency<T extends { agentcisClientId: string; id?: string }>(
    items: T[],
    entityType: EntityUnionType,
    apiMethod: (batch: T[]) => Promise<BulkResponse>,
    maxConcurrent: number = 5,
    migrationId: string
  ): Promise<ProcessResult> {
    const chunks = this.chunkArray(items, this.batchSize);
    const limit = pLimit(maxConcurrent);

    this.logger.info(`Processing ${items.length} ${entityType} with concurrency ${maxConcurrent}`, {
      batchSize: this.batchSize,
      totalBatches: chunks.length,
      maxConcurrent,
    });

    const promises = chunks.map((chunk, index) =>
      limit(() => this.processSingleChunk(chunk, entityType, apiMethod, index, migrationId))
    );

    const results = await Promise.all(promises);

    return results.reduce(
      (acc, result) => ({
        successful: acc.successful + result.successful,
        failed: acc.failed + result.failed,
        skipped: acc.skipped + result.skipped,
        errors: [...acc.errors, ...result.errors],
      }),
      { successful: 0, failed: 0, skipped: 0, errors: [] as ProcessResult['errors'] }
    );
  }

  private async processSingleChunk<T extends { agentcisClientId: string; id?: string }>(
    chunk: T[],
    entityType: EntityUnionType,
    apiMethod: (batch: T[]) => Promise<BulkResponse>,
    batchIndex: number,
    migrationId: string
  ): Promise<ProcessResult> {
    const result: ProcessResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const response = await apiMethod.call(this.apiClient, chunk);

      const successCount = response.successful?.length ?? 0;
      const failedCount = response.failed?.length ?? 0;

      for (const success of response.successful ?? []) {
        await this.mappingRepository.storeMapping(migrationId, entityType, {
          agentcisId: success.internalId,
          applyimsId: success.id,
        });
      }

      result.successful += successCount;
      result.failed += failedCount;

      if (response.failed) {
        result.errors.push(
          ...response.failed.map((f) => ({
            entityType,
            entityId: f.internalId,
            error: f.error,
            code: f.code || 'RECORD_FAILURE',
          }))
        );
      }

      this.logger.info(`Concurrent batch ${batchIndex + 1} completed for ${entityType}`, {
        successful: successCount,
        failed: failedCount,
        batchSize: chunk.length,
      });
    } catch (error: any) {
      await this.handleError(error, entityType, chunk, batchIndex, result, migrationId);
    }

    return result;
  }

  private async handleError(
    error: any,
    entityType: string,
    chunk: any[],
    batchIndex: number,
    results: ProcessResult,
    migrationId: string
  ): Promise<void> {
    const category = this.categorizeError(error);
    const entityId = String(chunk[0]?.id ?? `batch-${batchIndex}`);

    await this.errorRecoveryManager.logError(migrationId, entityType, entityId, error, category, {
      chunk,
    });

    if (this.errorRecoveryManager.isSkippable(category)) {
      this.logger.warn(`Skipping batch ${batchIndex} due to skippable error: ${category}`, {
        entityType,
        error: error.message,
      });
      results.skipped += chunk.length;
    } else if (this.errorRecoveryManager.isRetryable(category)) {
      this.logger.error(`Batch ${batchIndex} failed`, {
        entityType,
        error: error.message,
      });
      results.failed += chunk.length;
      results.errors.push({
        entityType,
        entityId: `batch-${batchIndex}`,
        error: error.message ?? 'Unknown error',
        code: 'RETRY_EXHAUSTED',
      });
    } else {
      this.logger.error(`Batch ${batchIndex} failed for ${entityType}`, error);
      results.failed += chunk.length;
      results.errors.push({
        entityType,
        entityId: `batch-${batchIndex}`,
        error: error.message ?? 'Unknown error',
        code: 'BATCH_FAILURE',
      });
    }
  }

  private categorizeError(error: any): ErrorCategory {
    const message = error.message?.toLowerCase() ?? '';
    const status = error.response?.status;

    if (status === 0 || message.includes('network') || message.includes('ECONNREFUSED')) {
      return ErrorCategory.NETWORK_ERROR;
    }

    if (status === 429 || status === 503 || status >= 500) {
      return ErrorCategory.API_ERROR;
    }

    if (status === 400 || status === 422 || message.includes('validation')) {
      return ErrorCategory.VALIDATION_ERROR;
    }

    if (message.includes('transform') || message.includes('parse')) {
      return ErrorCategory.TRANSFORMATION_ERROR;
    }

    return ErrorCategory.API_ERROR;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
