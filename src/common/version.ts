import { join } from 'node:path';
import { readAppVersion } from '@heyatom/nest-common';

/** package.json `version`; the path resolves the same from `src/` and `dist/`. */
export const APP_VERSION = readAppVersion(join(__dirname, '../..'));
