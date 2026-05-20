import { Module } from '@nestjs/common';
import { FileHarborService } from './fileharbor.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [],
  imports: [HttpModule],
  providers: [FileHarborService],
  exports: [FileHarborService]
})
export class FileHarborModule {}
