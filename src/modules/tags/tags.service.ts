import {ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException} from '@nestjs/common';
import {PrismaService} from '@/modules/prisma/prisma.service';
import {CreateTagDto} from '@/modules/tags/dto/create-tag.dto';
import {UpdateTagDto} from '@/modules/tags/dto/update-tag.dto';
import {limit, PagedResponse} from "@/pagination";
import {TagsListQuery} from "@/modules/tags/queries/tags.query";
import {TagDto} from "@/modules/tags/dto/tags.dto";
import {plainToInstance} from "class-transformer";
import {slugifySafe} from '@/utils/slugify';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(TagsService.name);

  private readonly CONFLICT_ERROR_MESSAGE = "Slug already exists";

  async create(tenantId: string, dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: {
          tenantId,
          name: dto.name,
          slug: slugifySafe(dto.name),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(this.CONFLICT_ERROR_MESSAGE);
      }
      throw error;
    }
  }

  async findAll(tenantId: string, filters?: TagsListQuery): Promise<PagedResponse<TagDto>> {
    try {
      this.logger.debug('Fetching all tags from the database');
      this.logger.debug(`Filters received from ${tenantId}: ${JSON.stringify(filters)}`);

      const [items, count] = await this.prisma.$transaction([
        this.prisma.tag.findMany({
          where: {
            ...(filters.name && { name: { contains: filters.name, mode: 'insensitive' } }),
            tenantId: tenantId,
          },
          orderBy: { name: 'asc' },
          take: limit(filters),
          skip: filters.offset,
          include: {
            tenant: {
              select: {
                slug: true,
                name: true,
              }
            },
            _count: {
              select: { articles: true },
            },
          },
        }),
        this.prisma.tag.count({
          where: {
            ...(filters.name && { name: { contains: filters.name, mode: 'insensitive' } }),
            tenantId: tenantId,
          },
        }),
      ]);

      const pageSize = filters.limit ?? 10;
      const currentPage = Math.floor((filters.offset ?? 0) / pageSize) + 1;

      this.logger.debug(`Found ${count} tags matching the criteria`);

      return {
        items: plainToInstance(TagDto, items,  {
          excludeExtraneousValues: false
        }),
        pagination: {
          totalCount: count,
          currentPage,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch tags', error.stack);
      this.logger.error(`Error name: ${error.name}, Error message: ${error.message}`);
      if (error.code) {
        this.logger.error(`Prisma error code: ${error.code}`);
      }
      throw new InternalServerErrorException('Failed to fetch characters');
    }
  }

  async findOne(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            enabled: true,
          }
        },
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return plainToInstance(TagDto, tag, {
      excludeExtraneousValues: false
    });
  }

  async findOneBySlug(tenantId: string, slug: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { slug, tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            enabled: true,
          }
        },
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return plainToInstance(TagDto, tag, {
      excludeExtraneousValues: false
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTagDto) {
    const existingTag = await this.findOne(tenantId, id);

    const data: UpdateTagDto & { slug?: string } = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      if (dto.name !== existingTag.name) {
        data.slug = slugifySafe(dto.name);
      }
    }

    try {
      return await this.prisma.tag.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(this.CONFLICT_ERROR_MESSAGE);
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

