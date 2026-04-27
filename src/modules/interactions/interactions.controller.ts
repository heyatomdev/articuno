import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { InteractionsService } from '@/modules/interactions/interactions.service';
import { ArticleInteractionParamsDto } from '@/modules/interactions/dto/article-interaction-params.dto';

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

  @Post('articles/:articleId/bookmark')
  toggleBookmarkArticle(
    @GetTenant() tenant: any,
    @Param() params: ArticleInteractionParamsDto,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.interactionsService.toggleBookmarkArticle(
      tenant.id,
      params.articleId,
      this.requireUserId(externalUserId),
    );
  }

  @Get('articles/:articleId/status')
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

  @Get('me/bookmarks')
  getMyBookmarks(
    @GetTenant() tenant: any,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.interactionsService.getMyBookmarks(
      tenant.id,
      this.requireUserId(externalUserId),
    );
  }
}

