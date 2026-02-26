import {
  getMigrationStatusController,
  startMigrationController,
} from 'api/controllers/migration.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/start', startMigrationController);
router.get('/:id/status', getMigrationStatusController);

export default router;
