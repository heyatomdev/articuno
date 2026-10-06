/**
 * Writes the OpenAPI document to a file without a database or a listening port:
 * `pnpm openapi:dump [out.json]` (default `openapi.json`). Consumed by
 * `@heyatom/client`'s `gen:types`. Nest only instantiates providers here, it never
 * runs `onModuleInit`, so Prisma does not connect; dummy values satisfy the
 * env validation when no `.env` is present.
 */
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

process.env.DATABASE_URL ??= 'postgresql://openapi:dump@localhost:5432/openapi';
process.env.BASTION_URL ??= 'http://localhost:3001';

async function dump(out: string) {
  const { AppModule } = await import('../src/modules/app/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Articuno')
    .setVersion(process.env.npm_package_version || '2.0.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .addBearerAuth()
    .build();
  writeFileSync(out, JSON.stringify(SwaggerModule.createDocument(app, config), null, 2) + '\n');
  await app.close();
}

dump(process.argv[2] ?? 'openapi.json').catch((err) => {
  console.error(err);
  process.exit(1);
});
