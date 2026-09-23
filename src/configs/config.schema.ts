import * as process from 'node:process';

export default () => ({
  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '',
  trustProxy: process.env.TRUST_PROXY === 'true',
  baseUrl: process.env.BASE_URL || '',

  // Database
  database: process.env.DATABASE_URL,

  // Rate limiting. `ttl` is in SECONDS here — ThrottlerModule in app.module.ts
  // multiplies by 1000. Both keys were read there long before this namespace
  // existed, so the module was registering `{ ttl: NaN, limit: undefined }` and
  // never blocked anything; it went unnoticed while no guard used it.
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_SECONDS, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
});
