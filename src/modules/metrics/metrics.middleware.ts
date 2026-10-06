import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/** Never instrumented — polling /health/* and /status would otherwise pollute the histogram with its own traffic. */
function isSkipped(path: string): boolean {
  return path.startsWith('/health') || path === '/status';
}

/**
 * Observes `http_request_duration_seconds` for every request.
 *
 * A middleware, not an interceptor: interceptors run after the guards and
 * after TenantMiddleware, so a request rejected with 401 or 429 never reaches
 * one — and those are exactly the statuses the alerts are for. Registered on
 * AppModule, which Nest wires before any other module's middleware (lowest
 * module distance), so it also wraps TenantMiddleware. The `finish` event
 * fires for every response, whatever produced it. The label is the matched
 * route pattern (`/articles/:id`), never the raw URL, which carries ids and
 * would blow up cardinality; a request rejected before the router matched
 * (e.g. by TenantMiddleware) is labelled `unmatched`.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (isSkipped(req.path)) return next();

    // Nest mounts this middleware as a catch-all route (`/{*splat}`), so
    // `req.route` is already that catch-all here — and stays so when no
    // controller matches. Remembered to tell the two apart on finish.
    // Express types `Request.route` as `any`; narrowed so the label is a string.
    const mountRoute = req.route as { path?: string } | undefined;
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const matched = req.route as { path?: string } | undefined;
      const route =
        (matched !== mountRoute ? matched?.path : undefined) ?? 'unmatched';
      this.metrics.httpRequestDuration.observe(
        { method: req.method, route, status: String(res.statusCode) },
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    });
    next();
  }
}
