import pLimit from 'p-limit';
import { ApplyIMSApiClient, BulkResponse } from './api-client.js';
import { MappingRepository, EntityType } from '../repositories/mapping.repository.js';
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

export interface BatchConfig {
  batchSize?: number;
  maxConcurrent?: number;
  maxRetries?: number;
}

export class BatchProcessor {
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private apiClient: ApplyIMSApiClient,
    private mappingRepository: MappingRepository,
    private errorRecoveryManager: ErrorRecoveryManager,
    private logger: Logger,
    private batchSize: number = 100,
    config: BatchConfig = {}
  ) {
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = 1000;
  }

  async processBatch<T extends { agentcisClientId: string; id?: string }>(
    items: T[],
    entityType: EntityType,
    apiMethod: (batch: T[]) => Promise<BulkResponse>,
    migrationId: string
  ): Promise<ProcessResult> {
    const chunks = this.chunkArray(items, this.batchSize);
    const results: ProcessResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    this.logger.info(`Processing ${items.length} ${entityType} in ${chunks.length} batches`, {
      batchSize: this.batchSize,
      totalBatches: chunks.length,
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const response = await this.executeWithRetry(apiMethod, chunk, entityType);

        const successCount = response.successful?.length ?? 0;
        const failedCount = response.failed?.length ?? 0;

        for (const success of response.successful ?? []) {
          await this.mappingRepository.storeMapping(migrationId, entityType, {
            agentcisId: success.internalId,
            applyimsId: success.id,
          });
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
        }

        this.logger.info(`Batch ${i + 1}/${chunks.length} completed for ${entityType}`, {
          successful: successCount,
          failed: failedCount,
          batchSize: chunk.length,
        });
      } catch (error: any) {
        await this.handleError(error, entityType, chunk, i, results, migrationId);
      }
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
    entityType: EntityType,
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
    entityType: EntityType,
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
      const response = await this.executeWithRetry(apiMethod, chunk, entityType);

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

  private async executeWithRetry<T>(
    apiMethod: (batch: T[]) => Promise<BulkResponse>,
    chunk: T[],
    entityType: EntityType
  ): Promise<BulkResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await apiMethod.call(this.apiClient, chunk);
      } catch (error: any) {
        lastError = error;
        const category = this.categorizeError(error);

        if (!this.errorRecoveryManager.isRetryable(category)) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Retry attempt ${attempt}/${this.maxRetries} for ${entityType} after ${delay}ms`,
            { error: error.message }
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
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
      this.logger.error(`Batch ${batchIndex} failed after ${this.maxRetries} retries`, {
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
