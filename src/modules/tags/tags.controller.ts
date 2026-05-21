import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post, Query,
  UseGuards, ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TagsService } from '@/modules/tags/tags.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';
import { TagParamsDto } from '@/modules/tags/dto/tag-params.dto';
import { TagSlugParamsDto } from '@/modules/tags/dto/tag-slug-params.dto';
import { TagsListQuery } from "@/modules/tags/queries/tags.query";
import { PagedResponse } from "@/pagination";
import { TagDto } from "@/modules/tags/dto/tags.dto";

@ApiTags('Tags')
@ApiSecurity('x-api-key')
@Controller('tags')
@UseGuards(TenantGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a tag',
    description: 'Creates a new tag for the current tenant. The slug is auto-generated from the name.',
  })
  @ApiBody({ type: CreateTagDto })
  @ApiResponse({ status: 201, description: 'Tag created successfully.', type: TagDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 409, description: 'A tag with this slug already exists for the tenant.' })
  create(@GetTenant() tenant: any, @Body() dto: CreateTagDto) {
    return this.tagsService.create(tenant.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List tags',
    description: 'Returns a paginated list of tags belonging to the current tenant. Optionally filter by name.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of tags.', type: TagDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  findAll(@GetTenant() tenant: any, @Query(new ValidationPipe({ transform: true })) filters: TagsListQuery): Promise<PagedResponse<TagDto>> {
    return this.tagsService.findAll(tenant.id, filters);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a tag by slug',
    description: 'Returns a single tag identified by its URL-friendly slug.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly slug of the tag (e.g. "technology")', example: 'technology' })
  @ApiResponse({ status: 200, description: 'Tag found.', type: TagDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  findOne(@GetTenant() tenant: any, @Param() params: TagSlugParamsDto) {
    return this.tagsService.findOneBySlug(tenant.id, params.slug);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a tag',
    description: 'Updates the name (and consequently the slug) of an existing tag.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the tag to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateTagDto })
  @ApiResponse({ status: 200, description: 'Tag updated successfully.', type: TagDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  @ApiResponse({ status: 409, description: 'A tag with the new slug already exists for the tenant.' })
  update(
    @GetTenant() tenant: any,
    @Param() params: TagParamsDto,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a tag',
    description: 'Permanently deletes a tag and removes its associations with existing articles.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the tag to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  async remove(@GetTenant() tenant: any, @Param() params: TagParamsDto) {
    await this.tagsService.remove(tenant.id, params.id);
  }
}

