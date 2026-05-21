import { Router, Request, Response } from 'express';
import { getDatabaseConnection } from '../../configs/database.config.js';
import { ContactActivityExtractor } from '../../extractors/contact-activity.extractor.js';
import { ContactActivityTransformer } from '../../transformers/contact-activity.transformer.js';
import { ContactExtractor } from '../../extractors/contact.extractor.js';
import { ContactTransformer } from '../../transformers/contact.transformer.js';
import { NoteExtractor } from '../../extractors/note.extractor.js';
import { NoteTransformer } from '../../transformers/note.transformer.js';
import { IdResolver } from '../../transformers/utils/id-resolver.js';
import { FieldMapper } from '../../transformers/utils/field-mappers.js';
import { logger } from '../../utils/logger.js';

const router = Router();

router.get('/contact-activities-transform', async (_req: Request, res: Response) => {
  try {
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

router.get('/contact-transform', async (_req: Request, res: Response) => {
  try {
    const dbConnections = getDatabaseConnection();

    if (!dbConnections?.agentcisDb) {
      res.status(500).json({
        status: 'error',
        message: 'Database connection not initialized',
      });
      return;
    }

    const extractorConfig = {
      batchSize: 50,
      startDate: new Date('2020-01-01'),
      endDate: new Date(),
    };

    const extractor = new ContactExtractor(dbConnections.agentcisDb, extractorConfig);
    const idResolver = IdResolver.createPhaseResolver(dbConnections.etlDb, logger);
    const fieldMapper = new FieldMapper();
    const transformer = new ContactTransformer(idResolver, fieldMapper);

    const batch = await extractor.extractBatch(0, 50);

    if (batch.length === 0) {
      res.json({
        status: 'success',
        message: 'No contacts found',
        data: [],
      });
      return;
    }

    const transformed = await Promise.all(batch.map((item) => transformer.transform(item)));

    res.json({
      status: 'success',
      message: `Transformed ${transformed.length} contacts`,
      data: transformed,
      sourceCount: batch.length,
    });
  } catch (error) {
    console.log('error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Contact transform test failed', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      message: errorMessage,
    });
  }
});

router.get('/note-transform', async (_req: Request, res: Response) => {
  try {
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

    const extractor = new NoteExtractor(dbConnections.agentcisDb, extractorConfig);
    const idResolver = IdResolver.createPhaseResolver(dbConnections.etlDb, logger);
    const transformer = new NoteTransformer(idResolver);

    const batch = await extractor.extractBatch(null, 10);

    if (batch.length === 0) {
      res.json({
        status: 'success',
        message: 'No notes found',
        data: [],
      });
      return;
    }

    const transformed = await Promise.all(batch.map((item) => transformer.transform(item)));

    res.json({
      status: 'success',
      message: `Transformed ${transformed.length} notes`,
      data: transformed,
      sourceCount: batch.length,
    });
  } catch (error) {
    console.log('error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Note transform test failed', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      message: errorMessage,
    });
  }
});

export default router;
