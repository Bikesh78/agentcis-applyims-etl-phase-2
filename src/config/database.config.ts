import Joi from 'joi';

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
