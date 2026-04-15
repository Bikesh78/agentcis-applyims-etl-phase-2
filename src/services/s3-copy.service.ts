import {
  S3Client,
  CopyObjectCommand,
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger.js';

export interface S3CopyOptions {
  sourceBucket: string;
  sourceKey: string;
  destinationBucket: string;
  destinationKey: string;
}

export class S3CopyService {
  private s3Client: S3Client;
  private logger: Logger;

  constructor(region: string, logger: Logger) {
    this.s3Client = new S3Client({ region });
    this.logger = logger;
  }

  async copyFile(options: S3CopyOptions): Promise<CopyObjectCommandOutput> {
    const copySource = `${options.sourceBucket}/${options.sourceKey}`;

    const params: CopyObjectCommandInput = {
      CopySource: copySource,
      Bucket: options.destinationBucket,
      Key: options.destinationKey,
    };

    this.logger.info('Copying file in S3', {
      sourceBucket: options.sourceBucket,
      sourceKey: options.sourceKey,
      destinationBucket: options.destinationBucket,
      destinationKey: options.destinationKey,
    });

    this.logger.info('Copying file in S3', {
      sourceBucket: options.sourceBucket,
      sourceKey: options.sourceKey,
      destinationBucket: options.destinationBucket,
      destinationKey: options.destinationKey,
    });

    const result = await this.s3Client.send(new CopyObjectCommand(params));

    this.logger.info('File copied successfully', {
      destinationKey: options.destinationKey,
    });

    return result;
  }

  async copyMultiple(
    files: S3CopyOptions[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        await this.copyFile(files[i]);
        successful++;
      } catch (error) {
        failed++;
        this.logger.error('Failed to copy file', {
          error,
          sourceKey: files[i].sourceKey,
        });
      }
      onProgress?.(i + 1, files.length);
    }

    return { successful, failed };
  }
}
