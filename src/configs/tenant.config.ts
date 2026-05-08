import Joi from 'joi';

export interface TenantConfig {
  companyId: string;
  domain: string;
}

export const tenantConfigSchema = Joi.object<TenantConfig>({
  companyId: Joi.string().required().messages({
    'any.required': 'TENANT_COMPANY_ID is required',
  }),
  domain: Joi.string().hostname().required().messages({
    'string.hostname': 'TENANT_DOMAIN must be a valid hostname',
    'any.required': 'TENANT_DOMAIN is required',
  }),
});
