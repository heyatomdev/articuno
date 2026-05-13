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
import { TagsService } from '@/modules/tags/tags.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';
import { TagParamsDto } from '@/modules/tags/dto/tag-params.dto';
import { TagsListQuery } from "@/modules/tags/queries/tags.query";
import {PagedResponse} from "@/pagination";
import {TagDto} from "@/modules/tags/dto/tags.dto";

@Controller('tags')
@UseGuards(TenantGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@GetTenant() tenant: any, @Body() dto: CreateTagDto) {
    return this.tagsService.create(tenant.id, dto);
  }

  @Get()
  findAll(@GetTenant() tenant: any, @Query(new ValidationPipe({ transform: true })) filters: TagsListQuery): Promise<PagedResponse<TagDto>> {
    return this.tagsService.findAll(tenant.id, filters);
  }

  @Get(':id')
  findOne(@GetTenant() tenant: any, @Param() params: TagParamsDto) {
    return this.tagsService.findOne(tenant.id, params.id);
  }

  @Patch(':id')
  update(
    @GetTenant() tenant: any,
    @Param() params: TagParamsDto,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: TagParamsDto) {
    await this.tagsService.remove(tenant.id, params.id);
  }
}

