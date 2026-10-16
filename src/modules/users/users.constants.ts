/**
 * `users.externalId` of the per-tenant reporter behind automatic reports
 * (banned words). Internal: hidden from user lists, not writable via the API.
 */
export const SYSTEM_REPORTER_ID = 'articuno:system';

/**
 * `users.externalId` of the per-tenant placeholder that inherits a deleted
 * user's comments, so threads survive the deletion anonymised.
 */
export const DELETED_USER_ID = 'articuno:deleted';

/** Internal users: hidden from user lists, not writable via the API. */
export const SYSTEM_EXTERNAL_IDS = [SYSTEM_REPORTER_ID, DELETED_USER_ID];
