import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './modules/app/app.module';
import { HttpExceptionFilter } from '@/filters/http-exception.filter';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  try {
    const bootstrapLogger = new Logger('Bootstrap');

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const environment = configService.get<string>('environment') ?? 'development';
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

    // Enable CORS
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : !isProduction,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-API-Key', 'X-User-Id', 'Authorization'],
      credentials: true,
    });
    if (isProduction && corsOrigins.length === 0) {
      bootstrapLogger.warn('CORS_ORIGIN is not set in production: browser cross-origin requests are disabled');
    }

    // Use global exception filter
    app.useGlobalFilters(new HttpExceptionFilter());

    app.useBodyParser('json', { limit: '1mb' });
    app.useBodyParser('urlencoded', { limit: '256kb', extended: true });

    app.use(cookieParser());

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Articuno')
        .setDescription('Multi-tenant CMS management system built with NestJS, Prisma ORM, and PostgreSQL.')
        .setVersion(process?.env?.npm_package_version || '2.0.0')
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
        .addBearerAuth()
        .setLicense(
            'MIT',
            'https://github.com/heyatomdev/articuno/blob/main/README.md',
        )
        .setContact('Andrea Tombolato', 'https://heyatom.dev', 'hey@heyatom.dev')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/docs', app, document);

    await app.listen(port);

    bootstrapLogger.log(`🚀 Articuno started successfully`);
    bootstrapLogger.log(`📚 API Documentation: http://localhost:${port}/docs`);
    bootstrapLogger.log(`📈 Metrics endpoint: http://localhost:${port}/metrics`);
    bootstrapLogger.log(`📝 Logging enabled for: log, error, warn, debug, verbose`);
    bootstrapLogger.log(`Current BASE_URL is set to: ${baseUrl}`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    Logger.error('❌ Failed to start the application', 'Bootstrap');

    if (message.includes('Database connection failed')) {
      Logger.error('Database connection issue detected', 'Bootstrap');
    } else if (message.includes('EADDRINUSE')) {
      Logger.error(`Port is already in use. Another service might be running on the same port`, 'Bootstrap');
    } else if (message.includes('EACCES')) {
      Logger.error(`Permission denied. You might not have permission to bind to this port`, 'Bootstrap');
    } else {
      Logger.error(`Unexpected error: ${message}`, 'Bootstrap');
    }

    Logger.error('Stack trace:', stack ?? 'N/A', 'Bootstrap');
    throw error;
  }
}

bootstrap()
    .then(() => {
      Logger.log('🎉 App running now', 'Bootstrap');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';

      Logger.error('💥 Critical error during application startup:', 'Bootstrap');
      Logger.error(message, 'Bootstrap');
      Logger.error('🔄 Please fix the issues above and try again', 'Bootstrap');
      process.exit(1);
    });
