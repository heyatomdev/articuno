import type { SwaggerOptions } from '@heyatom/nest-common';
import { APP_VERSION } from './version';

/** Shared by `/docs` (main.ts) and `pnpm openapi:dump`: one document. */
export const SWAGGER_OPTIONS: SwaggerOptions = {
  title: 'Articuno',
  version: APP_VERSION,
  description:
    'Multi-tenant CMS management system built with NestJS, Prisma ORM, and PostgreSQL.',
  configure: (b) =>
    b
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .addBearerAuth()
      .setLicense(
        'MIT',
        'https://github.com/heyatomdev/articuno/blob/main/README.md',
      )
      .setContact('Andrea Tombolato', 'https://heyatom.dev', 'hey@heyatom.dev'),
};
