import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
import { BookmarksService } from '@/modules/bookmarks/bookmarks.service';
import { BookmarkParamsDto } from '@/modules/bookmarks/dto/bookmark-params.dto';
import { PagedQuery } from '@/pagination';

@ApiTags('Bookmarks')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'X-User-Id',
  description: 'External user ID required for all bookmark endpoints',
  required: true,
})
@Controller('bookmarks')
@UseGuards(TenantGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  private requireUserId(externalUserId?: string): string {
    if (!externalUserId || !externalUserId.trim()) {
      throw new BadRequestException('Header X-User-Id mancante');
    }

    return externalUserId.trim();
  }

  @Post(':articleId')
  @ApiOperation({
    summary: 'Toggle bookmark on an article',
    description:
      'Adds a bookmark if the article is not yet bookmarked by the user, or removes it if it already exists.',
  })
  @ApiParam({
    name: 'articleId',
    description: 'UUID of the article to bookmark/unbookmark',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 201, description: 'Bookmark toggled successfully.' })
  @ApiResponse({ status: 400, description: 'Missing X-User-Id header or invalid articleId.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  toggle(
    @GetTenant() tenant: any,
    @Param() params: BookmarkParamsDto,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.bookmarksService.toggle(
      tenant.id,
      params.articleId,
      this.requireUserId(externalUserId),
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get bookmarked articles for the current user',
    description:
      'Returns a paginated list of articles bookmarked by the current user within the tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of bookmarked articles returned successfully.',
  })
  @ApiResponse({ status: 400, description: 'Missing X-User-Id header.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  findAll(
    @GetTenant() tenant: any,
    @Query() query: PagedQuery,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.bookmarksService.findAll(
      tenant.id,
      this.requireUserId(externalUserId),
      query,
    );
  }
}

