import 'dotenv/config';
import {
  createAgentcisConnectionOptions,
  createEtlConnectionOptions,
} from '../src/configs/database.config.js';
import { DataSource } from 'typeorm';
import { ApplyIMSApiClient } from '../src/loaders/api-client.js';
import { BatchProcessor } from '../src/loaders/batch-processor.js';
import { CheckpointService } from '../src/services/checkpoint.service.js';
import { ErrorRecoveryManager } from '../src/loaders/error-recovery.js';
import { MappingRepository } from '../src/repositories/mapping.repository.js';
import {
  MigrationOrchestrator,
  MigrationConfig,
} from '../src/orchestrators/migration.orchestrator.js';
import { apiConfigSchema } from '../src/configs/api.config.js';
import { logger as appLogger } from '../src/utils/logger.js';
import config from 'config';

async function runTest() {
  console.log('=== Testing MigrationOrchestrator ===\n');

  const apiConfig = apiConfigSchema.validate(config.get('applyimsApi')).value;
  if (!apiConfig) {
    console.error('Invalid API config');
    process.exit(1);
  }

  console.log('1. Initializing databases...');
  const agentcisDs = new DataSource(createAgentcisConnectionOptions());
  const etlDs = new DataSource(createEtlConnectionOptions());
  await agentcisDs.initialize();
  await etlDs.initialize();
  console.log('AgentCIS and ETL DB connected\n');

  console.log('2. Authenticating with ApplyIMS API...');
  const apiClient = new ApplyIMSApiClient(apiConfig, appLogger);
  await apiClient.authenticate();
  console.log('Authenticated\n');

  console.log('3. Setting up dependencies...');
  const mappingRepository = new MappingRepository(etlDs);
  const errorRecoveryManager = new ErrorRecoveryManager(etlDs, appLogger);
  const checkpointService = new CheckpointService(etlDs, appLogger);

  const batchProcessor = new BatchProcessor(
    apiClient,
    mappingRepository,
    errorRecoveryManager,
    appLogger,
    10
  );
  console.log('Dependencies ready\n');

  console.log('4. Setting up MigrationOrchestrator...');
  const orchestrator = new MigrationOrchestrator(
    agentcisDs,
    etlDs,
    apiClient,
    batchProcessor,
    checkpointService,
    errorRecoveryManager,
    appLogger
  );
  console.log('Orchestrator ready\n');

  const migrationConfig: MigrationConfig = {
    migrationId: `migration-${Date.now()}`,
    entities: ['contacts'],
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-02'),
    },
    batchSize: 10,
    parallelism: 5,
  };

  console.log('5. Running migration...');
  console.log(`Config: ${JSON.stringify(migrationConfig, null, 2)}\n`);

  try {
    const result = await orchestrator.runMigration(migrationConfig);

    console.log('\n6. Migration Result:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n7. Checking checkpoints in ETL DB...');
    const checkpoints = await checkpointService.getAllCheckpoints(migrationConfig.migrationId);
    console.log(`Checkpoints found: ${checkpoints.length}`);
    for (const cp of checkpoints) {
      console.log(
        `  - ${cp.entityType}: ${cp.processedCount}/${cp.totalCount} (${cp.successCount} success, ${cp.failedCount} failed)`
      );
    }

    console.log('\n8. Checking stored mappings in ETL DB...');
    const contactsMapping = await mappingRepository.getMapping('contacts', '1');
    console.log(`Contact 1: ${contactsMapping ? `Mapped to ${contactsMapping}` : 'Not mapped'}`);

    console.log('\n=== Test Complete ===');
  } catch (error: any) {
    console.error('\nMigration failed:', error.message);

    console.log('\n9. Checking error logs in ETL DB...');
    const { MigrationError } = await import('entities/etlDb/migration-errors.entity.js');
    const errors = await etlDs.getRepository(MigrationError).find({
      where: { migrationId: migrationConfig.migrationId },
    });
    console.log(`Errors logged: ${errors.length}`);
    for (const err of errors.slice(0, 5)) {
      console.log(`  - ${err.entityType}: ${err.errorMessage} (${err.errorCode})`);
    }

    throw error;
  } finally {
    await agentcisDs.destroy();
    await etlDs.destroy();
  }
}

runTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
