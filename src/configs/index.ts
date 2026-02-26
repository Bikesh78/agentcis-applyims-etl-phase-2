import Joi from 'joi';
import { DatabaseConfig, databaseConfigSchema } from './database.config.js';
import { ApiConfig, apiConfigSchema } from './api.config.js';
import { LoggerConfig, loggerConfigSchema } from './logger.config.js';
import config from 'config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  agentcisDb: DatabaseConfig;
  etlDb: DatabaseConfig;
  applyimsApi: ApiConfig;
  // migration: MigrationConfig;
  logger: LoggerConfig;
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
  agentcisDb: databaseConfigSchema.required().messages({
    'any.required': 'AgentCIS database configuration is required',
  }),
  etlDb: databaseConfigSchema.required(),
  applyimsApi: apiConfigSchema.required(),
  // migration: migrationConfigSchema.required().messages({
  //   'any.required': 'Migration configuration is required',
  // }),
  logger: loggerConfigSchema.required(),
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
    // migration: config.get('migration'),
    logger: config.get('logger'),
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
