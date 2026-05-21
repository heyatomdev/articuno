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
} from '@nestjs/common';
import { CommentsService } from '@/modules/comments/comments.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentParamsDto } from '@/modules/comments/dto/comment-params.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';
import { ContentStatus } from '@prisma/client';

@Controller('comments')
@UseGuards(TenantGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@GetTenant() tenant: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(tenant.id, dto);
  }

  @Get()
  findAll(@GetTenant() tenant: any, @Query() query: CommentFiltersQueryDto) {
    return this.commentsService.findAll(tenant.id, query, ContentStatus.VISIBLE);
  }

  @Get(':id')
  findOne(@GetTenant() tenant: any, @Param() params: CommentParamsDto) {
    return this.commentsService.findOne(tenant.id, params.id, ContentStatus.VISIBLE);
  }

  @Patch(':id')
  update(
    @GetTenant() tenant: any,
    @Param() params: CommentParamsDto,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: CommentParamsDto) {
    await this.commentsService.remove(tenant.id, params.id);
  }
}

