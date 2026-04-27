import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {CreateReportDto} from "@/modules/reports/dto/create-report.dto";
import {UpdateReportStatusDto} from "@/modules/reports/dto/update-report.dto"; // Assumi di avere un PrismaService

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) {}

    async create(tenantId: string, dto: CreateReportDto) {
        // 1. Assicurati che l'utente (reporter) esista localmente (Minimal User)
        const user = await this.prisma.user.upsert({
            where: {
                externalId_tenantId: {
                    externalId: dto.reporterId,
                    tenantId,
                },
            },
            update: {},
            create: { externalId: dto.reporterId, tenantId },
        });

        // 2. Crea il report
        return this.prisma.report.create({
            data: {
                targetType: dto.targetType,
                targetId: dto.targetId,
                reason: dto.reason,
                description: dto.description,
                reporterId: user.externalId, // Salviamo l'ID esterno per coerenza
                tenantId: tenantId,
            },
        });
    }

    async findAll(tenantId: string, status?: string) {
        return this.prisma.report.findMany({
            where: {
                tenantId,
                ...(status && { status: status as any })
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateStatus(id: string, tenantId: string, dto: UpdateReportStatusDto) {
        const report = await this.prisma.report.findFirst({
            where: { id, tenantId },
        });

        if (!report) throw new NotFoundException('Report non trovato');

        return this.prisma.report.update({
            where: { id },
            data: {
                status: dto.status,
                moderatorNote: dto.moderatorNote,
                moderatorId: dto.moderatorId,
            },
        });
    }
}
