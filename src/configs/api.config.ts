import Joi from 'joi';

export interface ApiConfig {
  url: string;
  email: string;
  password: string;
  timeout: number;
  rateLimitRps: number;
  domain: string;
  origin: string;
  maxAuthRetries: number;
  tenantId: string;
}

export const apiConfigSchema = Joi.object<ApiConfig>({
  url: Joi.string().uri().required().messages({
    'string.uri': 'API URL must be a valid URI',
    'any.required': 'API URL is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'API email must be a valid email',
    'any.required': 'API email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'API password is required',
  }),
  timeout: Joi.number()
    .positive()
    .default(60 * 1000 * 12)
    .messages({
      'number.positive': 'API timeout must be a positive number',
    }),
  rateLimitRps: Joi.number().positive().default(60).messages({
    'number.positive': 'Rate limit RPS must be a positive number',
  }),
  domain: Joi.string().uri().messages({
    'string.uri': 'Domain must be a valid URI',
  }),
  origin: Joi.string().uri().messages({
    'string.uri': 'Origin must be a valid URI',
  }),
  maxAuthRetries: Joi.number().integer().min(0).default(3).messages({
    'number.integer': 'Max auth retries must be an integer',
    'number.min': 'Max auth retries must be at least 0',
  }),
  tenantId: Joi.string().required().messages({
    'any.required': 'Tenant ID is required',
  }),
});
