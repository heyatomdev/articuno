import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannedWordDto } from './dto/create-banned-word.dto';
import { limit, PagedResponse } from '@/pagination';
import { BannedWordListQueryDto } from './dto/banned-word-list-query.dto';
import { BannedWordDto } from './dto/banned-word.dto';

@Injectable()
export class BannedWordsService {
    constructor(private prisma: PrismaService) {}

    async create(tenantId: string, dto: CreateBannedWordDto) {
        const wordClean = dto.word.toLowerCase().trim();

        // Verifichiamo se esiste già per questo tenant
        const exists = await this.prisma.bannedWord.findFirst({
            where: { word: wordClean, tenantId },
        });

        if (exists) {
            throw new ConflictException('Questa parola è già presente nella blacklist.');
        }

        return this.prisma.bannedWord.create({
            data: {
                word: wordClean,
                tenantId,
            },
        });
    }

    async findAll(
        tenantId: string,
        filters: BannedWordListQueryDto,
    ): Promise<PagedResponse<BannedWordDto>> {
        const pageSize = limit(filters);
        const offset = filters.offset ?? 0;

        const [items, totalCount] = await this.prisma.$transaction([
            this.prisma.bannedWord.findMany({
                where: { tenantId },
                orderBy: { word: 'asc' },
                take: pageSize,
                skip: offset,
            }),
            this.prisma.bannedWord.count({
                where: { tenantId },
            }),
        ]);

        return {
            items,
            pagination: {
                totalCount,
                currentPage: Math.floor(offset / pageSize) + 1,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize),
            },
        };
    }

    private async findAllForTenant(tenantId: string) {
        return this.prisma.bannedWord.findMany({
            where: { tenantId },
            orderBy: { word: 'asc' },
        });
    }

    async remove(id: string, tenantId: string) {
        const word = await this.prisma.bannedWord.findFirst({
            where: { id, tenantId },
        });

        if (!word) {
            throw new NotFoundException('Parola non trovata nel database del tenant.');
        }

        return this.prisma.bannedWord.delete({
            where: { id },
        });
    }

    // Metodo helper utile per gli altri moduli (Commenti/Articoli)
    async checkText(tenantId: string, text: string): Promise<boolean> {
        const bannedWords = await this.findAllForTenant(tenantId);
        const lowercaseText = text.toLowerCase();

        return bannedWords.some(bw => lowercaseText.includes(bw.word));
    }
}
