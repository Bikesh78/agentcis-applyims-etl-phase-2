import Joi from 'joi';

export interface ApiConfig {
  url: string;
  email: string;
  password: string;
  timeout: number;
  rateLimitRps: number;
  domain: string;
  origin: string;
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
  timeout: Joi.number().positive().default(30000).messages({
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
});
