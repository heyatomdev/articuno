import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { limit, PagedResponse } from '@/pagination';
import { CategoryListQueryDto } from '@/modules/categories/dto/category-list-query.dto';
import { slugifySafe } from '@/utils/slugify';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: {
          tenantId,
          ...dto,
          slug: slugifySafe(dto.name),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug gia esistente');
      }
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    query: CategoryListQueryDto,
  ): Promise<PagedResponse<any>> {
    const where = { tenantId };

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit(query),
        skip: query.offset,
        include: {
          _count: {
            select: { articles: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    const pageSize = query.limit ?? 20;
    const currentPage = Math.floor((query.offset ?? 0) / pageSize) + 1;

    return {
      items: items.map(({ _count, ...category }) => ({
        ...category,
        articlesCount: _count.articles,
      })),
      pagination: {
        totalCount,
        currentPage,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Categoria non trovata');
    }

    return category;
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const existingCategory = await this.findOne(tenantId, id);

    const data: UpdateCategoryDto & { slug?: string } = { ...dto };
    if (dto.name !== undefined && dto.name !== existingCategory.name) {
      data.slug = slugifySafe(dto.name);
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug gia esistente');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.category.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Categoria non trovata');
    }
  }
}
