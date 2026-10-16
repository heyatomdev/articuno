import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';
import { PaginatedResult, paginate } from '@heyatom/nest-common';
import { TagsListQuery } from '@/modules/tags/queries/tags.query';
import { TagDto } from '@/modules/tags/dto/tags.dto';
import { plainToInstance } from 'class-transformer';
import { nextFreeSlug, slugify } from '@/utils/slugify';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(TagsService.name);

  private readonly CONFLICT_ERROR_MESSAGE = 'Slug already exists';

  async create(tenantId: string, dto: CreateTagDto) {
    const base = slugify(dto.name);
    const taken = await this.prisma.tag.findMany({
      where: { tenantId, slug: { startsWith: base } },
      select: { slug: true },
    });

    try {
      return await this.prisma.tag.create({
        data: {
          tenantId,
          name: dto.name,
          slug: nextFreeSlug(
            base,
            taken.map((t) => t.slug),
          ),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: this.CONFLICT_ERROR_MESSAGE,
        });
      }
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    filters?: TagsListQuery,
  ): Promise<PaginatedResult<TagDto>> {
    try {
      this.logger.debug('Fetching all tags from the database');
      this.logger.debug(
        `Filters received from ${tenantId}: ${JSON.stringify(filters)}`,
      );

      const [items, count] = await this.prisma.$transaction([
        this.prisma.tag.findMany({
          where: {
            ...(filters.name && {
              name: { contains: filters.name, mode: 'insensitive' },
            }),
            tenantId: tenantId,
          },
          orderBy: { name: 'asc' },
          take: filters.limit,
          skip: filters.skip,
          include: {
            tenant: {
              select: {
                slug: true,
                name: true,
              },
            },
            _count: {
              select: { articles: true },
            },
          },
        }),
        this.prisma.tag.count({
          where: {
            ...(filters.name && {
              name: { contains: filters.name, mode: 'insensitive' },
            }),
            tenantId: tenantId,
          },
        }),
      ]);

      this.logger.debug(`Found ${count} tags matching the criteria`);

      return paginate(
        plainToInstance(TagDto, items, {
          excludeExtraneousValues: false,
        }),
        count,
        filters,
      );
    } catch (error) {
      this.logger.error('Failed to fetch tags', error.stack);
      this.logger.error(
        `Error name: ${error.name}, Error message: ${error.message}`,
      );
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
          },
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
      excludeExtraneousValues: false,
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
          },
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
      excludeExtraneousValues: false,
    });
  }

  /** The slug never follows `name`: it changes only when `slug` is passed (admin). */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateTagDto & { slug?: string },
  ) {
    await this.findOne(tenantId, id);

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: { name: dto.name, slug: dto.slug },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: this.CONFLICT_ERROR_MESSAGE,
        });
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
