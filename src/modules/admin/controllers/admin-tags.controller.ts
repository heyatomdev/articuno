import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { TagsService } from '@/modules/tags/tags.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';
import { TagParamsDto } from '@/modules/tags/dto/tag-params.dto';
import { TagsListQuery } from '@/modules/tags/queries/tags.query';
import { PagedResponse } from '@/pagination';
import { TagDto } from '@/modules/tags/dto/tags.dto';

@Controller('admin/tags')
@UseGuards(SessionGuard)
export class AdminTagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateTagDto) {
    return this.tagsService.create(session.tenantId, dto);
  }

  @Get()
  findAll(
    @GetSession() session: any,
    @Query(new ValidationPipe({ transform: true })) filters: TagsListQuery,
  ): Promise<PagedResponse<TagDto>> {
    return this.tagsService.findAll(session.tenantId, filters);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: TagParamsDto) {
    return this.tagsService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  update(
    @GetSession() session: any,
    @Param() params: TagParamsDto,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(session.tenantId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: TagParamsDto) {
    await this.tagsService.remove(session.tenantId, params.id);
  }
}

