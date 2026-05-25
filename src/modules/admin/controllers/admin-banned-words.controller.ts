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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateBannedWordDto } from '@/modules/banned-worlds/dto/create-banned-word.dto';
import { BannedWordListQueryDto } from '@/modules/banned-worlds/dto/banned-word-list-query.dto';
import { PagedResponse } from '@/pagination';
import { BannedWordDto } from '@/modules/banned-worlds/dto/banned-word.dto';

@ApiTags('Admin / Banned Words')
@ApiCookieAuth('sessionId')
@Controller('admin/banned-words')
@UseGuards(SessionGuard)
export class AdminBannedWordsController {
  constructor(private readonly bannedWordsService: BannedWordsService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a banned word',
    description: 'Adds a new word to the tenant\'s banned word list. The word must be between 2 and 50 characters.',
  })
  @ApiBody({ type: CreateBannedWordDto })
  @ApiResponse({ status: 201, description: 'Banned word added successfully.', type: BannedWordDto })
  @ApiResponse({ status: 400, description: 'Validation error – word is missing or out of length bounds.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  create(@GetSession() session: any, @Body() dto: CreateBannedWordDto) {
    return this.bannedWordsService.create(session.tenantId, dto, {
      actorUserId: session.externalId,
      actorRole: session.userRole,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'List banned words',
    description: 'Returns a paginated list of banned words for the session tenant.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of banned words.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: any,
    @Query(new ValidationPipe({ transform: true })) filters: BannedWordListQueryDto,
  ): Promise<PagedResponse<BannedWordDto>> {
    return this.bannedWordsService.findAll(session.tenantId, filters);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a banned word',
    description: 'Permanently removes a banned word entry from the tenant\'s list.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the banned word entry to remove', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Banned word removed successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Banned word not found.' })
  async remove(@Param('id') id: string, @GetSession() session: any) {
    await this.bannedWordsService.remove(id, session.tenantId, {
      actorUserId: session.externalId,
      actorRole: session.userRole,
    });
  }
}

