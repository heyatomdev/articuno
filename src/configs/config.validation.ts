import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Server
  PORT: Joi.number().positive().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),
});
