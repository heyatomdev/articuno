import { Module } from '@nestjs/common';
import { BannedWordsService } from './banned-words.service';
import { BannedWordsController } from './banned-words.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [BannedWordsController],
    providers: [BannedWordsService],
    exports: [BannedWordsService],
})
export class BannedWordsModule {}
