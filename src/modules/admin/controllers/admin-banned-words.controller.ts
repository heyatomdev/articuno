import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateBannedWordDto } from '@/modules/banned-worlds/dto/create-banned-word.dto';
import { BannedWordListQueryDto } from '@/modules/banned-worlds/dto/banned-word-list-query.dto';
import { PagedResponse } from '@/pagination';
import { BannedWordDto } from '@/modules/banned-worlds/dto/banned-word.dto';

@Controller('admin/banned-words')
@UseGuards(SessionGuard)
export class AdminBannedWordsController {
  constructor(private readonly bannedWordsService: BannedWordsService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateBannedWordDto) {
    return this.bannedWordsService.create(session.tenantId, dto);
  }

  @Get()
  findAll(
    @GetSession() session: any,
    @Query(new ValidationPipe({ transform: true })) filters: BannedWordListQueryDto,
  ): Promise<PagedResponse<BannedWordDto>> {
    return this.bannedWordsService.findAll(session.tenantId, filters);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @GetSession() session: any) {
    await this.bannedWordsService.remove(id, session.tenantId);
  }
}

