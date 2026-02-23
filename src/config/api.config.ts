import Joi from 'joi';

export interface ApiConfig {
  url: string;
}

export const apiConfigSchema = Joi.object<ApiConfig>({
  url: Joi.string().uri().required().messages({
    'string.uri': 'API URL must be a valid URI',
    'any.required': 'API URL is required',
  }),
});
