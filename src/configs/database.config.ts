import { DataSource, DataSourceOptions } from 'typeorm';
import Joi from 'joi';
import 'dotenv/config';
import config from 'config';
import { logger } from 'utils/logger.js';
import { Clients } from 'entities/agentcis/clients.entity.js';
import { Applications } from 'entities/agentcis/applications.entity.js';
import { Products } from 'entities/agentcis/products.entity.js';
import { OfficeVisits } from 'entities/agentcis/office-visits.entity.js';
import { OfficeVisitsAssignees } from 'entities/agentcis/office-visits-assignees.entity.js';
import { Attachment } from 'entities/agentcis/attachments.entity.js';
import { Referrers } from 'entities/agentcis/referrers.entity.js';
import { GroupProductFees } from 'entities/agentcis/group-product-fees.entity.js';
import { ApplicationAssignees } from 'entities/agentcis/application-assignees.entity.js';
import { TempMappedContact } from 'entities/etlDb/temp-mapped-contacts.entity.js';
import { TempMappedApplication } from 'entities/etlDb/temp-mapped-appplication.entity.js';
import { TempMappedDeal } from 'entities/etlDb/temp-mapped-deals.entity.js';
import { TempMappedOfficeVisit } from 'entities/etlDb/temp-mapped-office-visits.entity.js';
import { TempMappedMedia } from 'entities/etlDb/temp-mapped-medias.entity.js';
import { MigrationCheckpoint } from 'entities/etlDb/migration-checkpoints.entity.js';
import { MigrationError } from 'entities/etlDb/migration-errors.entity.js';
import { MigrationJob } from 'entities/etlDb/migration-jobs.entity.js';
import { RelatedOffices } from 'entities/agentcis/related-offices.entity.js';
import { Branches } from 'entities/agentcis/branches.entity.js';
import { ApplicationActivities } from 'entities/agentcis/application-activities.entity.js';
import { TempMappedContactActivity } from 'entities/etlDb/temp-mapped-contact-activities.entity.js';
import { ApplicationStages } from 'entities/agentcis/application-stages.entity.js';
import { Users } from 'entities/agentcis/users.entity.js';
import { TempMappedUser } from 'entities/etlDb/temp-mapped-users.entity.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  type: string;
}

export const databaseConfigSchema = Joi.object<DatabaseConfig>({
  host: Joi.string().hostname().required().messages({
    'string.hostname': 'Database host must be a valid hostname',
    'any.required': 'Database host is required',
  }),
  port: Joi.number().port().required().messages({
    'number.port': 'Database port must be a valid port number',
    'any.required': 'Database port is required',
  }),
  username: Joi.string().required().messages({
    'any.required': 'Database username is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Database password is required',
  }),
  database: Joi.string().required().messages({
    'any.required': 'Database name is required',
  }),
  type: Joi.string().required().messages({
    'any.required': 'Database type is required',
  }),
});

export interface DatabaseConnection {
  agentcisDb: DataSource;
  etlDb: DataSource;
}

function getDbConfig() {
  return {
    agentcisDb: config.get<DatabaseConfig>('agentcisDb'),
    etlDb: config.get<DatabaseConfig>('etlDb'),
  };
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const CONNECTION_TIMEOUT = 10000;

const poolConfig = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
};

let dbConnections: DatabaseConnection | null = null;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgentcisConnectionOptions() {
  const dbConfig = getDbConfig().agentcisDb;

  return {
    type: 'mysql',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    synchronize: false,
    logging: false,
    pool: poolConfig,
    connectTimeout: CONNECTION_TIMEOUT,
    entities: [
      Clients,
      Applications,
      Products,
      OfficeVisits,
      OfficeVisitsAssignees,
      Attachment,
      Referrers,
      GroupProductFees,
      ApplicationAssignees,
      RelatedOffices,
      Branches,
      ApplicationActivities,
      ApplicationStages,
      Users,
    ],
  } as DataSourceOptions;
}

export function createEtlConnectionOptions() {
  const dbConfig = getDbConfig().etlDb;

  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    logging: false,
    pool: poolConfig,
    connectTimeout: CONNECTION_TIMEOUT,
    synchronize: false,
    entities: [
      TempMappedContact,
      TempMappedApplication,
      TempMappedDeal,
      TempMappedOfficeVisit,
      TempMappedMedia,
      MigrationCheckpoint,
      MigrationError,
      MigrationJob,
      TempMappedContactActivity,
      TempMappedUser,
    ],
  } as DataSourceOptions;
}

async function createAgentcisConnection(attempt: number = 1): Promise<DataSource> {
  const options = createAgentcisConnectionOptions();

  try {
    logger.info(`Connecting to AgentCIS database (attempt ${attempt}/${MAX_RETRIES})...`);
    const connection = new DataSource(options);
    await connection.initialize();
    logger.info('AgentCIS database connected successfully');
    return connection;
  } catch (error) {
    logger.error(`Failed to connect to AgentCIS database (attempt ${attempt}/${MAX_RETRIES}):`, {
      error,
    });

    if (attempt < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      logger.info(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return createAgentcisConnection(attempt + 1);
    }
    throw error;
  }
}

async function createEtlConnection(attempt: number = 1): Promise<DataSource> {
  const options = createEtlConnectionOptions();

  try {
    logger.info(`Connecting to ETL database (attempt ${attempt}/${MAX_RETRIES})...`);
    const connection = new DataSource(options);
    await connection.initialize();
    logger.info('ETL database connected successfully');
    return connection;
  } catch (error) {
    logger.error(`Failed to connect to ETL database (attempt ${attempt}/${MAX_RETRIES}):`);

    if (attempt < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      logger.info(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return createEtlConnection(attempt + 1);
    }
    throw error;
  }
}

export async function initializeDatabases(): Promise<DatabaseConnection> {
  if (dbConnections) {
    return dbConnections;
  }

  logger.info('Initializing database connections...');

  try {
    const [agentcisDb, etlDb] = await Promise.all([
      createAgentcisConnection(),
      createEtlConnection(),
    ]);

    dbConnections = { agentcisDb, etlDb };
    logger.info('All database connections initialized successfully');
    return dbConnections;
  } catch (error) {
    logger.error('Failed to initialize database connections:', { error });
    throw error;
  }
}

export async function closeConnections(): Promise<void> {
  logger.info('Closing database connections...');

  if (!dbConnections) {
    logger.info('No database connections to close');
    return;
  }

  try {
    if (dbConnections.agentcisDb.isInitialized) {
      await dbConnections.agentcisDb.destroy();
      logger.info('AgentCIS database connection closed');
    }

    if (dbConnections.etlDb.isInitialized) {
      await dbConnections.etlDb.destroy();
      logger.info('ETL database connection closed');
    }

    dbConnections = null;
    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', { error });
    throw error;
  }
}

export function getDatabaseConnection(): DatabaseConnection | null {
  return dbConnections;
}
