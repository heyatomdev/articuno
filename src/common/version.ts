/**
 * Application version, read from package.json at runtime.
 *
 * `require` (not `import`) on purpose: importing the JSON would pull a file
 * outside the inferred `rootDir` into the compilation and shift the emitted
 * `dist/` layout. The relative path resolves identically from `src/common/`
 * and `dist/common/`.
 *
 * Mirrors `fileharbor/src/common/version.ts` — the console reads the same
 * field name (`version`) from every service that reports one.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION: string = pkg.version;
