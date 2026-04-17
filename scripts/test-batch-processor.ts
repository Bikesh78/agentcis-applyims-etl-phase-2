import 'dotenv/config';
import {
  createAgentcisConnectionOptions,
  createEtlConnectionOptions,
} from '../src/configs/database.config.js';
import { DataSource } from 'typeorm';
import { ContactExtractor } from '../src/extractors/contact.extractor.js';
import { ContactTransformer } from '../src/transformers/contact.transformer.js';
import { FieldMapper } from '../src/transformers/utils/field-mappers.js';
import { IdResolver } from '../src/transformers/utils/id-resolver.js';
import { ApplyIMSApiClient } from '../src/loaders/api-client.js';
import { BatchProcessor } from '../src/loaders/batch-processor.js';
import { MappingRepository } from '../src/repositories/mapping.repository.js';
import { ErrorRecoveryManager } from '../src/loaders/error-recovery.js';
import { apiConfigSchema } from '../src/configs/api.config.js';
import { logger as appLogger } from '../src/utils/logger.js';
import config from 'config';

async function runTest() {
  console.log('=== Testing BatchProcessor Integration ===\n');

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

  const extractorConfig = {
    batchSize: 10,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
  };

  console.log('2. Extracting 4 contacts from AgentCIS...');
  const extractor = new ContactExtractor(agentcisDs, extractorConfig);
  const contacts = await extractor.extractBatch(0, 2);
  console.log(`Extracted ${contacts.length} contacts`);
  contacts.forEach((c, i) =>
    console.log(`   [${i + 1}] ${c.firstName} ${c.lastName} (ID: ${c.id})`)
  );

  const fieldMapper = new FieldMapper();
  const idResolver = IdResolver.createPhaseResolver(agentcisDs, appLogger);
  const transformer = new ContactTransformer(idResolver, fieldMapper, appLogger);

  console.log('3. Transforming contacts to ApplyIMS format...');
  const transformedContacts: any[] = [];
  for (const contact of contacts) {
    try {
      const transformed = await transformer.transform(contact);
      transformedContacts.push(transformed);
      console.log(`Transformed: ${transformed.firstName} ${transformed.lastName}`);
    } catch (error: any) {
      console.error(`Failed to transform contact ${contact.id}:`, error.message);
    }
  }

  console.log('4. Authenticating with ApplyIMS API...');
  const client = new ApplyIMSApiClient(apiConfig, appLogger);
  await client.authenticate();
  console.log('Authenticated\n');

  console.log('5. Setting up BatchProcessor...');
  const mappingRepository = new MappingRepository(etlDs);
  const errorRecoveryManager = new ErrorRecoveryManager(etlDs, appLogger);
  const batchProcessor = new BatchProcessor(
    client,
    mappingRepository,
    errorRecoveryManager,
    appLogger,
    2
  );
  console.log('BatchProcessor ready\n');

  console.log('6. Running BatchProcessor.processBatch...');
  const result = await batchProcessor.processBatch(
    transformedContacts,
    'contacts',
    client.bulkCreateContacts.bind(client),
    'test-migration-001'
  );

  console.log('\n7. BatchProcessor Result:');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n=== Test Complete ===');
}

runTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
