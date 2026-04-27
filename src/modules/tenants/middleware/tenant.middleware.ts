import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {PrismaService} from "@/modules/prisma/prisma.service";
import * as crypto from 'crypto';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private prisma: PrismaService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
            throw new UnauthorizedException('API Key mancante');
        }

        // Hash the incoming API key to match the stored hash
        const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

        // Find tenant by hashed API key and enabled status
        const tenant = await this.prisma.tenant.findFirst({
            where: {
                apiKey: hashedApiKey,
                enabled: true
            },
        });

        if (!tenant) {
            throw new UnauthorizedException('API Key non valida o Tenant disattivato');
        }

        // Inject tenant object into request for use throughout the request scope
        req['tenant'] = tenant;
        next();
    }
}



