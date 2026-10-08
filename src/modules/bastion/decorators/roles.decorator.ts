import { Reflector } from '@nestjs/core';

/**
 * Bastion roles allowed on an `/admin/*` route, checked by `BastionUserGuard`.
 * Method-level overrides class-level. A route without `@Roles()` is ADMIN-only.
 *
 * Mirrors Meridian's `articuno-*` permissions (Bastion seed): content is
 * AUTHOR+, moderation (comments, reports, banned words, deletes, hide/ban)
 * is MODERATOR+, users/audits/webhooks/notifications are ADMIN+.
 */
export const Roles = Reflector.createDecorator<readonly string[]>();

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;
export const MODERATION_ROLES = [...ADMIN_ROLES, 'MODERATOR'] as const;
export const CONTENT_ROLES = [...MODERATION_ROLES, 'AUTHOR'] as const;
