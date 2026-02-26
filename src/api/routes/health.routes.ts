import { Router } from 'express';
import { getHealthController } from 'api/controllers/health.controller.js';

const router = Router();

router.get('/', getHealthController);

export default router;
