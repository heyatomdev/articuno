import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { UpsertUserDto } from '@/modules/users/dto/upsert-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(tenantId: string, dto: UpsertUserDto) {
    const updateData: {
      username?: string;
      language?: string;
      avatarUrl?: string;
    } = {};

    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    return this.prisma.user.upsert({
      where: {
        externalId_tenantId: {
          externalId: dto.externalId,
          tenantId,
        },
      },
      update: updateData,
      create: {
        externalId: dto.externalId,
        tenantId,
        username: dto.username,
        language: dto.language,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async deleteByExternalId(tenantId: string, externalId: string): Promise<void> {
    const result = await this.prisma.user.deleteMany({
      where: {
        tenantId,
        externalId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Utente non trovato');
    }
  }
}

