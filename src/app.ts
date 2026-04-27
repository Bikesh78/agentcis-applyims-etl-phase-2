import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import healthRoutes from './api/routes/health.routes.js';
import migrationRoutes from './api/routes/migration.routes.js';
import monitoringRoutes from './api/routes/monitoring.routes.js';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { loggingMiddleware } from './api/middleware/logging.middleware.js';

const app: Application = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(loggingMiddleware);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
});

app.use('/api/health', healthRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.use(errorMiddleware);

export default app;
