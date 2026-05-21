import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CommentsService } from '@/modules/comments/comments.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentParamsDto } from '@/modules/comments/dto/comment-params.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';

@ApiTags('Admin / Comments')
@ApiCookieAuth('sessionId')
@Controller('admin/comments')
@UseGuards(SessionGuard)
export class AdminCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all comments (admin)',
    description:
      'Returns a paginated list of all comments for the session tenant, regardless of status. Supports filtering by articleId.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of comments.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(@GetSession() session: any, @Query() query: CommentFiltersQueryDto) {
    return this.commentsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a comment by ID (admin)',
    description: 'Returns a single comment identified by its UUID, regardless of status.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the comment', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Comment found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  findOne(@GetSession() session: any, @Param() params: CommentParamsDto) {
    return this.commentsService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a comment (admin)',
    description: 'Partially updates a comment (e.g. content or status). All statuses can be set by admins.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the comment to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({ status: 200, description: 'Comment updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  update(
    @GetSession() session: any,
    @Param() params: CommentParamsDto,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(session.tenantId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a comment (admin)',
    description: 'Permanently deletes a comment.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the comment to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  async remove(@GetSession() session: any, @Param() params: CommentParamsDto) {
    await this.commentsService.remove(session.tenantId, params.id);
  }
}

