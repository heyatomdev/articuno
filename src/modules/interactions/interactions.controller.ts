import {
  BadRequestException,
  Controller,
  Get,
  Headers,
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

@ApiTags('Interactions')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'X-User-Id',
  description: 'External user ID required for all interaction endpoints',
  required: true,
})
@Controller('interactions')
@UseGuards(TenantGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  private requireUserId(externalUserId?: string) {
    if (!externalUserId || !externalUserId.trim()) {
      throw new BadRequestException('Header X-User-Id mancante');
    }

    return externalUserId.trim();
  }

  @Post('articles/:articleId/like')
  @ApiOperation({
    summary: 'Toggle like on an article',
    description: 'Toggles the like status for the given article by the authenticated user. Returns the updated like count and whether the user has liked the article.',
  })
  @ApiParam({ name: 'articleId', description: 'UUID of the article to like/unlike', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 201, description: 'Like toggled successfully.' })
  @ApiResponse({ status: 400, description: 'Missing X-User-Id header or invalid articleId.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
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
  @ApiOperation({
    summary: 'Get interaction status for an article',
    description: 'Returns whether the current user has liked and/or bookmarked the given article, along with total like and bookmark counts.',
  })
  @ApiParam({ name: 'articleId', description: 'UUID of the article to check', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Interaction status returned successfully.' })
  @ApiResponse({ status: 400, description: 'Missing X-User-Id header or invalid articleId.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
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
}

