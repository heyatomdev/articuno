import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetTenant = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenant; // Ritorna l'intero oggetto Tenant o solo l'ID
    },
);
