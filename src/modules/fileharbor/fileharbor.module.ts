import { Module } from '@nestjs/common';
import { FileHarborService } from './fileharbor.service';

@Module({
  providers: [FileHarborService],
  exports: [FileHarborService],
})
export class FileHarborModule {}
