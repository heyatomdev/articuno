import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Reads the `AdminSession` that `BastionUserGuard` attaches to the request.
 *
 * Kept under the name `@GetSession()` it had while the cookie guard also filled
 * `request.session`: the shape is unchanged, so no `/admin/*` handler had to move.
 */
export const GetSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.session;
  },
);
