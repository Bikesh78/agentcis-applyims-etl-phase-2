import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import healthRoutes from './api/routes/health.routes.js';
import migrationRoutes from './api/routes/migration.routes.js';
import monitoringRoutes from './api/routes/monitoring.routes.js';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { loggingMiddleware } from './api/middleware/logging.middleware.js';
import { logger } from 'utils/logger.js';
import { getConfig } from 'configs/index.js';
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

app.use('/api/health', healthRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.use(errorMiddleware);

export default app;
