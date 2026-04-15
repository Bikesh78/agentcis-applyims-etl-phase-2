import 'dotenv/config';
import app from './app.js';
import { getConfig } from './configs/index.js';
import { logger } from 'utils/logger.js';
import { initializeDatabases, closeConnections } from './configs/database.config.js';

let server: ReturnType<typeof app.listen> | null = null;

async function startServer(): Promise<void> {
  try {
    const config = getConfig();

    await initializeDatabases();

    server = app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error: unknown) {
    console.log('error', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('Failed to start server:', { message });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down server...');

  try {
    await closeConnections();
  } catch (error) {
    console.error('Error closing database connections:', error);
  }

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
