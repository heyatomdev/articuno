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

  // Bastion — see src/modules/bastion
  BASTION_URL: Joi.string().uri({ allowRelative: false }).required(),
  // Also the expected `serviceSlug` of a service-client token on the public API
  // (TenantMiddleware). Bastion registers the app and the service under one slug,
  // so this is the same value on both sides — no second key for the same fact.
  BASTION_APP_SLUG: Joi.string().default('articuno'),
  BASTION_JWKS_TTL_MS: Joi.number().positive().default(3_600_000),
  // Must include `meridian`: the console forwards its own user-JWT, whose appSlug
  // is `meridian`, not `articuno`.
  ADMIN_ACCEPTED_APP_SLUGS: Joi.string().default('articuno,meridian'),
  ADMIN_ACCEPTED_ROLES: Joi.string().default(
    'SUPER_ADMIN,ADMIN,MODERATOR,AUTHOR',
  ),

  // Rate limiting — validated so a typo fails at startup rather than turning
  // into a NaN window that never blocks.
  THROTTLE_TTL_SECONDS: Joi.number().positive().default(60),
  THROTTLE_LIMIT: Joi.number().positive().default(100),
});
