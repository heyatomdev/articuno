import * as Joi from 'joi';
import { swaggerEnabled } from '@heyatom/nest-common';

export const configValidationSchema = Joi.object({
  // /docs and /docs-json. Unset → on only when NODE_ENV is explicitly
  // development or test (fail-closed). Declared before NODE_ENV on purpose:
  // the default must see the raw NODE_ENV, not its `development` default.
  ENABLE_SWAGGER: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default((env: { NODE_ENV?: string }) => swaggerEnabled(env)),

  // Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Server
  PORT: Joi.number().positive().default(3000),
  // Deprecated names, still read as defaults for CORS_ORIGINS and
  // TRUST_PROXY_HOPS (declared before them on purpose: a function default only
  // sees the keys validated before it). Drop once every deploy is migrated.
  CORS_ORIGIN: Joi.string().allow('').optional(),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').optional(),
  // Comma-separated allowlist; empty = no cross-origin browser access.
  CORS_ORIGINS: Joi.string()
    .allow('')
    .default((env: { CORS_ORIGIN?: string }) => env.CORS_ORIGIN ?? ''),
  // Reverse-proxy hops in front of the app (`trust proxy`); 1 = nginx.
  TRUST_PROXY_HOPS: Joi.number()
    .integer()
    .min(0)
    .default((env: { TRUST_PROXY?: boolean }) => (env.TRUST_PROXY ? 1 : 0)),
  BASE_URL: Joi.string().uri({ allowRelative: false }).allow('').optional(),
  // Prometheus scrape port (src/modules/metrics) — internal network only.
  METRICS_PORT: Joi.number().port().default(9091),

  // pino levels; unset → info in production, debug elsewhere
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default((env: { NODE_ENV: string }) =>
      env.NODE_ENV === 'production' ? 'info' : 'debug',
    ),

  // Database
  DATABASE_URL: Joi.string().required(),
  // pg pool per replica: keep max × replicas under Postgres max_connections.
  DATABASE_POOL_MAX: Joi.number().integer().positive().default(10),
  DATABASE_POOL_TIMEOUT_MS: Joi.number().integer().positive().default(5000),

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

  // Creates the `default` tenant at startup when missing. Off in production
  // unless set explicitly; the generated API key is never logged there.
  SEED_DEFAULT_TENANT: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.boolean().default(false),
      otherwise: Joi.boolean().default(true),
    }),
  SEED_WEBHOOK_URL: Joi.string()
    .uri({ allowRelative: false })
    .allow('')
    .optional(),

  // Delivered webhook_events rows older than this are purged nightly.
  // Unsent and dead-lettered rows are never purged.
  WEBHOOK_EVENT_RETENTION_DAYS: Joi.number().integer().positive().default(30),
});
