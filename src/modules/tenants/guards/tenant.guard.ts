import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        if (!request.tenant) {
            throw new UnauthorizedException('Accesso negato: Tenant non identificato');
        }

        return true;
    }
}
