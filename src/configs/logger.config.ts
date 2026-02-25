import Joi from 'joi';
import { logLevels } from 'utils/logger.js';

export interface LoggerConfig {
  logLevel: string;
  logDir: string;
}

export const loggerConfigSchema = Joi.object<LoggerConfig>({
  logLevel: Joi.string()
    .valid(...logLevels)
    .required()
    .messages({
      'any.only': 'Log level must be one of [info, error, warn, debug]',
    }),
  logDir: Joi.string().required().messages({
    'any.required': 'Log directory is required',
  }),
});
