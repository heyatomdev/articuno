import { Controller, Get, Post, Body, Param, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateBannedWordDto } from '@/modules/banned-worlds/dto/create-banned-word.dto';

@Controller('admin/banned-words')
@UseGuards(SessionGuard)
export class AdminBannedWordsController {
  constructor(private readonly bannedWordsService: BannedWordsService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateBannedWordDto) {
    return this.bannedWordsService.create(session.tenantId, dto);
  }

  @Get()
  findAll(@GetSession() session: any) {
    return this.bannedWordsService.findAll(session.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @GetSession() session: any) {
    await this.bannedWordsService.remove(id, session.tenantId);
  }
}

