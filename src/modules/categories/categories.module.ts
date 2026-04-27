import { Module } from '@nestjs/common';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { CategoriesService } from '@/modules/categories/categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}

