import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { setupSwagger } from '@heyatom/nest-common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './modules/app/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SWAGGER_OPTIONS } from '@/common/swagger';

async function bootstrap(): Promise<void> {
  try {
    const bootstrapLogger = new Logger('Bootstrap');

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
    });
    app.useLogger(app.get(PinoLogger));

    const configService = app.get(ConfigService);
    const environment =
      configService.get<string>('environment') ?? 'development';
    const isProduction = environment === 'production';
    const corsOrigins = (configService.get<string>('corsOrigin') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const trustProxy = configService.get<boolean>('trustProxy') ?? false;
    const port = configService.get<number>('port') ?? 3000;
    const baseUrl = configService.get<string>('baseUrl') ?? 'Not Set';

    app.enableShutdownHooks();
    if (trustProxy) {
      app.set('trust proxy', 1);
    }

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Enable CORS. X-API-Key / X-User-Id are deliberately not allowed: the tenant
    // key is server-to-server only, a browser must never hold it.
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : !isProduction,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    if (isProduction && corsOrigins.length === 0) {
      bootstrapLogger.warn(
        'CORS_ORIGIN is not set in production: browser cross-origin requests are disabled',
      );
    }

    app.useBodyParser('json', { limit: '1mb' });
    app.useBodyParser('urlencoded', { limit: '256kb', extended: true });

    // /docs enumerates the whole API surface, admin routes included:
    // ENABLE_SWAGGER, resolved fail-closed in config.validation.ts.
    const swagger = configService.get<boolean>('ENABLE_SWAGGER');
    if (swagger) {
      setupSwagger(app, SWAGGER_OPTIONS);
    }

    await app.listen(port);

    bootstrapLogger.log(`Articuno started successfully`);
    if (swagger) {
      bootstrapLogger.log(`API Documentation: http://localhost:${port}/docs`);
    }
    bootstrapLogger.log(`Current BASE_URL is set to: ${baseUrl}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    Logger.error('Failed to start the application', 'Bootstrap');

    if (message.includes('Database connection failed')) {
      Logger.error('Database connection issue detected', 'Bootstrap');
    } else if (message.includes('EADDRINUSE')) {
      Logger.error(
        `Port is already in use. Another service might be running on the same port`,
        'Bootstrap',
      );
    } else if (message.includes('EACCES')) {
      Logger.error(
        `Permission denied. You might not have permission to bind to this port`,
        'Bootstrap',
      );
    } else {
      Logger.error(`Unexpected error: ${message}`, 'Bootstrap');
    }

    Logger.error('Stack trace:', stack ?? 'N/A', 'Bootstrap');
    throw error;
  }
}

bootstrap()
  .then(() => {
    Logger.log('App running now', 'Bootstrap');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';

    Logger.error('Critical error during application startup:', 'Bootstrap');
    Logger.error(message, 'Bootstrap');
    Logger.error('Please fix the issues above and try again', 'Bootstrap');
    process.exit(1);
  });
