import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: {
          tenantId,
          ...dto,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug gia esistente');
      }
      throw error;
    }
  }

  async findAll(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return categories.map(({ _count, ...category }) => ({
      ...category,
      articlesCount: _count.articles,
    }));
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
    await this.findOne(tenantId, id);

    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
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
