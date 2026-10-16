import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { InteractionsService } from '@/modules/interactions/interactions.service';
import { ArticleInteractionParamsDto } from '@/modules/interactions/dto/article-interaction-params.dto';
import {
  ArticleInteractionStatusDto,
  LikeToggleResultDto,
} from '@/modules/interactions/dto/interaction-response.dto';

const USER_ID_HEADER = {
  name: 'X-User-Id',
  description: 'External user ID of the end user',
  required: true,
};

@ApiTags('Interactions')
@ApiSecurity('api-key')
@Controller('interactions')
@UseGuards(TenantGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  private requireUserId(externalUserId?: string) {
    if (!externalUserId || !externalUserId.trim()) {
      throw new BadRequestException({
        code: 'USER_ID_REQUIRED',
        message: 'Header X-User-Id mancante',
      });
    }

    return externalUserId.trim();
  }

  @Post('articles/:articleId/like')
  @ApiHeader(USER_ID_HEADER)
  @ApiOperation({
    summary: 'Toggle like on an article',
    description:
      'Toggles the like status for the given article by the authenticated user. Returns the updated like count and whether the user has liked the article.',
  })
  @ApiParam({
    name: 'articleId',
    description: 'UUID of the article to like/unlike',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Like toggled successfully.',
    type: LikeToggleResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing X-User-Id header or invalid articleId.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({
    status: 404,
    description: 'Article not found or not PUBLISHED.',
  })
  toggleLikeArticle(
    @GetTenant() tenant: any,
    @Param() params: ArticleInteractionParamsDto,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.interactionsService.toggleLikeArticle(
      tenant.id,
      params.articleId,
      this.requireUserId(externalUserId),
    );
  }

  @Get('articles/:articleId/status')
  @ApiHeader(USER_ID_HEADER)
  @ApiOperation({
    summary: 'Get interaction status for an article',
    description:
      'Returns whether the current user has liked and/or bookmarked the given article, along with total like and bookmark counts.',
  })
  @ApiParam({
    name: 'articleId',
    description: 'UUID of the article to check',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction status returned successfully.',
    type: ArticleInteractionStatusDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing X-User-Id header or invalid articleId.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({
    status: 404,
    description: 'Article not found or not PUBLISHED.',
  })
  getArticleStatus(
    @GetTenant() tenant: any,
    @Param() params: ArticleInteractionParamsDto,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.interactionsService.getArticleStatus(
      tenant.id,
      params.articleId,
      this.requireUserId(externalUserId),
    );
  }

  @Post('articles/:articleId/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Count a view of an article',
    description:
      'Adds one to the article view counter. Call it server-side when the article page is served; No deduplication: filter bots and repeated views in the tenant site.',
  })
  @ApiParam({
    name: 'articleId',
    description: 'UUID of the viewed article',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 204, description: 'View counted.' })
  @ApiResponse({ status: 400, description: 'Invalid articleId.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({
    status: 404,
    description: 'Article not found or not PUBLISHED.',
  })
  async countView(
    @GetTenant() tenant: any,
    @Param() params: ArticleInteractionParamsDto,
  ) {
    await this.interactionsService.countView(tenant.id, params.articleId);
  }
}
