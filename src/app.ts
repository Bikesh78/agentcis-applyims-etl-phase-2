import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import healthRoutes from './api/routes/health.routes.js';
import migrationRoutes from './api/routes/migration.routes.js';
import monitoringRoutes from './api/routes/monitoring.routes.js';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { loggingMiddleware } from './api/middleware/logging.middleware.js';
import { IdResolver } from 'transformers/utils/id-resolver.js';
import { logger } from 'utils/logger.js';
import { getDatabaseConnection } from 'configs/database.config.js';
import { getConfig } from 'configs/index.js';
import { OfficeVisitExtractor } from 'extractors/office-visits.extractor.js';
import { OfficeVisitTransformer } from 'transformers/office-visit.transformer.js';
import { S3CopyOptions, S3CopyService } from 'services/s3-copy.service.js';

const app: Application = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(loggingMiddleware);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
});

app.use('/api/extract-test', async (_req: Request, res: Response) => {
  const { s3Bucket } = getConfig();
  const s3Service = new S3CopyService(s3Bucket.awsRegion, logger);
  const options: S3CopyOptions = {
    sourceBucket: 'agentcis-documents-dump',
    sourceKey: 'uploads/application_stage/attachments/00001f19f1f8f91a7be197476bc94be0.pdf',
    destinationBucket: s3Bucket.awsDestinationBucket,
    destinationKey: `${s3Bucket.awsBucketTenant}/contact__C76956/Contact-Documents/cram.pdf`,
  };

  const result = await s3Service.copyFile(options);

  res.json({ message: 'Copied', result });
});

app.use('/api/office-visit-test', async (_req: Request, res: Response) => {
  const dbConnection = getDatabaseConnection();
  if (!dbConnection?.agentcisDb) {
    throw new Error('Agentcis db not initialized');
  }
  const testExtractor = new OfficeVisitExtractor(dbConnection.agentcisDb, {
    startDate: new Date('2022-01-01'),
    endDate: new Date('2024-01-01'),
    batchSize: 100,
  });

  const batches = await testExtractor.extractBatch(0, 100);

  const resolver = IdResolver.createPhaseResolver(dbConnection.etlDb, logger);
  const transformer = new OfficeVisitTransformer(resolver);

  const transformedResults = await Promise.all(
    batches.map(async (visit) => {
      try {
        return await transformer.transform(visit);
      } catch (error) {
        return { error: (error as Error).message, source: visit };
      }
    })
  );

  res.json({ message: 'Testing office visit extraction', data: transformedResults });
});

app.use('/api/health', healthRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.use(errorMiddleware);

export default app;
