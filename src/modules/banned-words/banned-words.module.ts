import { Module } from '@nestjs/common';
import { BannedWordsService } from './banned-words.service';
import { BannedWordsController } from './banned-words.controller';
import { BannedWordsSeedService } from './banned-words-seed.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditsModule } from '@/modules/audits/audits.module';

@Module({
    imports: [PrismaModule, AuditsModule],
    controllers: [BannedWordsController],
    providers: [BannedWordsService, BannedWordsSeedService],
    exports: [BannedWordsService, BannedWordsSeedService],
})
export class BannedWordsModule {}
