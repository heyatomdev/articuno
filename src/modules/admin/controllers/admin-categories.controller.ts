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
import { CategoriesService } from '@/modules/categories/categories.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { CategoryParamsDto } from '@/modules/categories/dto/category-params.dto';
import { CategoryListQueryDto } from '@/modules/categories/dto/category-list-query.dto';

@Controller('admin/categories')
@UseGuards(SessionGuard)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(session.tenantId, dto);
  }

  @Get()
  findAll(@GetSession() session: any, @Query() query: CategoryListQueryDto) {
    return this.categoriesService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: CategoryParamsDto) {
    return this.categoriesService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  update(
    @GetSession() session: any,
    @Param() params: CategoryParamsDto,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(session.tenantId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: CategoryParamsDto) {
    await this.categoriesService.remove(session.tenantId, params.id);
  }
}

