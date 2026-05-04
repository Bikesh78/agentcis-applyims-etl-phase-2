import { Router, Request, Response } from 'express';
import { getDatabaseConnection } from '../../configs/database.config.js';
import { ContactActivityExtractor } from '../../extractors/contact-activity.extractor.js';
import { ContactActivityTransformer } from '../../transformers/contact-activity.transformer.js';
import { IdResolver } from '../../transformers/utils/id-resolver.js';
import { logger } from '../../utils/logger.js';

const router = Router();

router.get('/contact-activities-transform', async (_req: Request, res: Response) => {
  try {
    console.log('in here');
    const dbConnections = getDatabaseConnection();

    if (!dbConnections?.agentcisDb) {
      res.status(500).json({
        status: 'error',
        message: 'Database connection not initialized',
      });
      return;
    }

    const extractorConfig = {
      batchSize: 10,
      startDate: new Date('2020-01-01'),
      endDate: new Date(),
    };

    const extractor = new ContactActivityExtractor(dbConnections.agentcisDb, extractorConfig);
    const idResolver = IdResolver.createPhaseResolver(dbConnections.etlDb, logger);
    const transformer = new ContactActivityTransformer(idResolver);

    const batch = await extractor.extractBatch(0, 10);

    if (batch.length === 0) {
      res.json({
        status: 'success',
        message: 'No contact activities found',
        data: [],
      });
      return;
    }

    const transformed = await Promise.all(batch.map((item) => transformer.transform(item)));

    res.json({
      status: 'success',
      message: `Transformed ${transformed.length} contact activities`,
      data: transformed,
      sourceCount: batch.length,
    });
  } catch (error) {
    console.log('error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Contact activities transform test failed', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      message: errorMessage,
    });
  }
});

export default router;
