import { Module } from '@nestjs/common';
import { FileHarborService } from './fileharbor.service';
import { HttpModule } from '@nestjs/axios';

// Defaults for every FileHarbor call (per-call timeouts override): never
// follow redirects with the tenant API key, bound responses and uploads.
export const FILEHARBOR_HTTP_OPTIONS = {
  timeout: 15_000,
  maxRedirects: 0,
  maxContentLength: 1024 * 1024,
  maxBodyLength: FileHarborService.MAX_IMAGE_SIZE + 1024 * 1024,
};

@Module({
  controllers: [],
  imports: [HttpModule.register(FILEHARBOR_HTTP_OPTIONS)],
  providers: [FileHarborService],
  exports: [FileHarborService],
})
export class FileHarborModule {}
