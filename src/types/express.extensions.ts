import { MigrationOrchestrator } from '../orchestrators/migration.orchestrator.js';
import { CheckpointService } from '../services/checkpoint.service.js';

export interface Services {
  orchestrator: MigrationOrchestrator;
  checkpointService: CheckpointService;
}

declare module 'express' {
  interface Request {
    services?: Services;
  }
}
