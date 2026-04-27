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
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { CategoryParamsDto } from '@/modules/categories/dto/category-params.dto';

@Controller('categories')
@UseGuards(TenantGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@GetTenant() tenant: any, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(tenant.id, dto);
  }

  @Get()
  findAll(@GetTenant() tenant: any) {
    return this.categoriesService.findAll(tenant.id);
  }

  @Get(':id')
  findOne(@GetTenant() tenant: any, @Param() params: CategoryParamsDto) {
    return this.categoriesService.findOne(tenant.id, params.id);
  }

  @Patch(':id')
  update(
    @GetTenant() tenant: any,
    @Param() params: CategoryParamsDto,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: CategoryParamsDto) {
    await this.categoriesService.remove(tenant.id, params.id);
  }
}

