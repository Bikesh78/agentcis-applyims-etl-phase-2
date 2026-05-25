import { Router, Request, Response } from 'express';
import { getDatabaseConnection } from '../../configs/database.config.js';
import { ContactActivityExtractor } from '../../extractors/contact-activity.extractor.js';
import { ContactActivityTransformer } from '../../transformers/contact-activity.transformer.js';
import { ContactExtractor } from '../../extractors/contact.extractor.js';
import { ContactTransformer } from '../../transformers/contact.transformer.js';
import { NoteExtractor } from '../../extractors/note.extractor.js';
import { NoteTransformer } from '../../transformers/note.transformer.js';
import { OfficeVisitExtractor } from '../../extractors/office-visit.extractor.js';
import { OfficeVisitTransformer } from '../../transformers/office-visit.transformer.js';
import { CheckinExtractor } from '../../extractors/checkin.extractor.js';
import { CheckinTransformer } from '../../transformers/checkin.transformer.js';
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

router.get('/office-visit-transform', async (_req: Request, res: Response) => {
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
      endDate: new Date('2020-01-05'),
    };

    const extractor = new OfficeVisitExtractor(dbConnections.agentcisDb, extractorConfig);
    const idResolver = IdResolver.createPhaseResolver(dbConnections.etlDb, logger);
    const transformer = new OfficeVisitTransformer(idResolver);

    const batch = await extractor.extractBatch(null, 10);

    if (batch.length === 0) {
      res.json({
        status: 'success',
        message: 'No office visits found',
        data: [],
      });
      return;
    }

    const results = await Promise.allSettled(batch.map((item) => transformer.transform(item)));

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    res.json({
      status: 'success',
      message: `Transformed ${successCount}/${batch.length} office visits (${failureCount} failed)`,
      sourceCount: batch.length,
      data: results.map((result, i) => ({
        source: {
          id: batch[i].id,
          contactId: batch[i].contactId,
          visitPurpose: batch[i].visitPurpose,
          createdByName: batch[i].createdByName,
          activityNotes: batch[i].activityNotes,
        },
        ...(result.status === 'fulfilled'
          ? { transformed: result.value }
          : {
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            }),
      })),
    });
  } catch (error) {
    console.log('error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Office visit transform test failed', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      message: errorMessage,
    });
  }
});

router.get('/checkin-transform', async (_req: Request, res: Response) => {
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
      startDate: new Date('2025-01-01'),
      endDate: new Date(),
    };

    const extractor = new CheckinExtractor(
      dbConnections.agentcisDb,
      dbConnections.etlDb,
      extractorConfig
    );
    const idResolver = IdResolver.createPhaseResolver(dbConnections.etlDb, logger);
    const transformer = new CheckinTransformer(idResolver);

    const batch = await extractor.extractBatch(null, 10);

    if (batch.length === 0) {
      res.json({
        status: 'success',
        message: 'No checkins found',
        data: [],
      });
      return;
    }

    const results = await Promise.allSettled(batch.map((item) => transformer.transform(item)));

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;
    const skippedCount = results.filter((r) => r.status === 'fulfilled' && r.value === null).length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    const data = results.map((result, i) => ({
      source: {
        uuid: batch[i].uuid,
        attendeeEmail: batch[i].attendeeEmail,
        attendeeName: batch[i].attendeeName,
        hostEmail: batch[i].hostEmail,
        officeName: batch[i].officeName,
        visitCategory: batch[i].visitCategory,
        visitReason: batch[i].visitReason,
        checkInTime: batch[i].checkInTime,
        attendedTime: batch[i].attendedTime,
        completedTime: batch[i].completedTime,
        clientId: batch[i].clientId,
        hostUserId: batch[i].hostUserId,
        comments: batch[i].comments,
      },
      ...(result.status === 'fulfilled'
        ? { transformed: result.value }
        : {
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }),
    }));

    console.log('results', results);
    res.json({
      status: 'success',
      message: `Transformed ${successCount}/${batch.length} checkins (${skippedCount} skipped, ${failureCount} failed)`,
      sourceCount: batch.length,
      data,
    });
  } catch (error) {
    console.log('error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Checkin transform test failed', { error: errorMessage });
    res.status(500).json({
      status: 'error',
      message: errorMessage,
    });
  }
});

export default router;
