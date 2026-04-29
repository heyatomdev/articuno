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

});
