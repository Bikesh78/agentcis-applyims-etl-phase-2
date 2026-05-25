import Joi from 'joi';
import { DatabaseConfig, databaseConfigSchema } from './database.config.js';
import { ApiConfig, apiConfigSchema } from './api.config.js';
import { LoggerConfig, loggerConfigSchema } from './logger.config.js';
import config from 'config';
import { S3BucketConfig, s3BucketConfigSchema } from './s3-bucket.config.js';
import { TenantConfig, tenantConfigSchema } from './tenant.config.js';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  agentcisDb: DatabaseConfig;
  etlDb: DatabaseConfig;
  applyimsApi: ApiConfig;
  logger: LoggerConfig;
  s3Bucket: S3BucketConfig;
  tenant: TenantConfig;
  visitPurposeId: string;
  migrationAdminUserId: string;
}

const appConfigSchema = Joi.object<AppConfig>({
  nodeEnv: Joi.string().valid('development', 'staging', 'production').required().messages({
    'any.only': 'NODE_ENV must be one of: development, staging, production',
    'any.required': 'NODE_ENV is required',
  }),
  port: Joi.number().port().required().messages({
    'number.port': 'PORT must be a valid port number',
    'any.required': 'PORT is required',
  }),
  s3Bucket: s3BucketConfigSchema.required(),
  agentcisDb: databaseConfigSchema.required(),
  etlDb: databaseConfigSchema.required(),
  applyimsApi: apiConfigSchema.required(),
  logger: loggerConfigSchema.required(),
  tenant: tenantConfigSchema.required(),
  visitPurposeId: Joi.string().uuid().required().messages({
    'any.required': 'VISIT_PURPOSE_ID is required',
    'string.guid': 'VISIT_PURPOSE_ID must be a valid UUID',
  }),
  migrationAdminUserId: Joi.string().uuid().required().messages({
    'any.required': 'MIGRATION_ADMIN_USER_ID is required',
    'string.guid': 'MIGRATION_ADMIN_USER_ID must be a valid UUID',
  }),
});

let validatedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (validatedConfig) {
    return validatedConfig;
  }

  const rawConfig: AppConfig = {
    nodeEnv: config.get('nodeEnv'),
    port: config.get('port'),
    agentcisDb: config.get('agentcisDb'),
    etlDb: config.get('etlDb'),
    applyimsApi: config.get('applyimsApi'),
    logger: config.get('logger'),
    s3Bucket: config.get('s3Bucket'),
    tenant: config.get('tenant'),
    visitPurposeId: config.get('visitPurposeId'),
    migrationAdminUserId: config.get('migrationAdminUserId'),
  };

  const { error, value } = appConfigSchema.validate(rawConfig, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message).join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  validatedConfig = value;
  return validatedConfig;
}

export function getConfig(): AppConfig {
  if (!validatedConfig) {
    return loadConfig();
  }
  return validatedConfig;
}
