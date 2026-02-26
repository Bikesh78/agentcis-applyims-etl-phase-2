import { Router } from 'express';
import {
  getMonitorDashboardController,
  getMonitorLogsController,
} from 'api/controllers/monitoring.controller.js';

const router = Router();

router.get('/dashboard', getMonitorDashboardController);
router.get('/logs', getMonitorLogsController);

export default router;
