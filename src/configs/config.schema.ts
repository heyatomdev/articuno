import * as process from 'node:process';

export default () => ({
  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Server
  port: parseInt(process.env.PORT, 10) || 3000,

  // Database
  database: process.env.DATABASE_URL,

});
