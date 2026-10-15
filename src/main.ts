import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import {
  parseCorsOrigins,
  setupHttpApp,
  setupSwagger,
} from '@heyatom/nest-common';
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
    const port = configService.getOrThrow<number>('PORT');
    const baseUrl = configService.get<string>('BASE_URL') || 'Not Set';
    const corsOrigins = parseCorsOrigins(
      configService.get<string>('CORS_ORIGINS'),
    );

    // Shutdown hooks, trust proxy, helmet, CORS allowlist, 1mb JSON limit,
    // global ValidationPipe (whitelist + forbidNonWhitelisted + transform).
    // X-API-Key / X-User-Id are deliberately not in the CORS allowed headers:
    // the tenant key is server-to-server only, a browser must never hold it.
    setupHttpApp(app, {
      trustProxyHops: configService.getOrThrow<number>('TRUST_PROXY_HOPS'),
      corsOrigins,
    });
    app.useBodyParser('urlencoded', { limit: '256kb', extended: true });
    if (
      configService.get('NODE_ENV') === 'production' &&
      corsOrigins.length === 0
    ) {
      bootstrapLogger.warn(
        'CORS_ORIGINS is not set in production: browser cross-origin requests are disabled',
      );
    }

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
