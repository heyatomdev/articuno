import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {PrismaService} from "@/modules/prisma/prisma.service";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private prisma: PrismaService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
            throw new UnauthorizedException('API Key mancante');
        }

        // Cerchiamo il tenant (idealmente qui dovresti confrontare l'hash della chiave)
        const tenant = await this.prisma.tenant.findUnique({
            where: { apiKey, enabled: true },
        });

        if (!tenant) {
            throw new UnauthorizedException('API Key non valida o Tenant disattivato');
        }

        // Iniettiamo il tenant nell'oggetto request per renderlo disponibile ovunque
        req['tenant'] = tenant;
        next();
    }
}
