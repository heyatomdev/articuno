import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
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
    const tags = await this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      articlesCount: _count.articles,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, tenantId },
    });

    if (!tag) {
      throw new NotFoundException('Tag non trovato');
    }

    return tag;
  }

  async update(tenantId: string, id: string, dto: UpdateTagDto) {
    await this.findOne(tenantId, id);

    try {
      return await this.prisma.tag.update({
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
    const result = await this.prisma.tag.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Tag non trovato');
    }
  }
}

