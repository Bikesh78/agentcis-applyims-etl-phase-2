import 'dotenv/config';
import app from './app.js';
import { getConfig } from './config/index.js';

let server: ReturnType<typeof app.listen> | null = null;

async function startServer(): Promise<void> {
  try {
    const config = getConfig();
    server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
