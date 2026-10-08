import { Reflector } from '@nestjs/core';

/**
 * Bastion roles allowed on an `/admin/*` route, checked by `BastionUserGuard`.
 * Method-level overrides class-level. A route without `@Roles()` is
 * SUPER_ADMIN-only.
 *
 * Mirrors the `articuno-*` permissions in Bastion's seed, which Meridian
 * enforces: content (`articuno-content.*`) is AUTHOR+, moderation
 * (`articuno-moderation.manage`: comments, reports, banned words, deletes,
 * hide/ban) is MODERATOR+, users and config (`articuno-users.manage`,
 * `articuno-config.manage`: audits, webhooks, notifications) are granted to
 * no role, i.e. SUPER_ADMIN only.
 */
export const Roles = Reflector.createDecorator<readonly string[]>();

export const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'] as const;
export const MODERATION_ROLES = [
  ...SUPER_ADMIN_ROLES,
  'ADMIN',
  'MODERATOR',
] as const;
export const CONTENT_ROLES = [...MODERATION_ROLES, 'AUTHOR'] as const;
