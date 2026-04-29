import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Server
  PORT: Joi.number().positive().default(3000),
  CORS_ORIGIN: Joi.string().allow('').optional(),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  BASE_URL: Joi.string().uri({ allowRelative: false }).allow('').optional(),

  // Database
  DATABASE_URL: Joi.string().required(),
});
