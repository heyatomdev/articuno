# Ruoli admin e matrice endpoint

Chi può chiamare cosa sotto `/admin/*`. Ricostruito dal codice: se diverge, vince il codice
(`src/modules/bastion/decorators/roles.decorator.ts`, `src/modules/bastion/guards/bastion-user.guard.ts`,
`src/modules/admin/controllers/`).

## Modello

- I ruoli **non** vivono in Articuno: arrivano dal claim `role` del user-JWT Bastion (RS256,
  verificato contro la JWKS in cache). Articuno non ha tabella ruoli né campo `role` su `User`.
- Ruoli accettati: `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `AUTHOR` (`ADMIN_ACCEPTED_ROLES`).
  App accettate: `articuno`, `meridian` (`ADMIN_ACCEPTED_APP_SLUGS`; Meridian inoltra il proprio
  user-JWT, con `appSlug` = `meridian`). Qualsiasi altro ruolo o app → `403` dal guard del package
  `@heyatom/bastion-client`. I token `service_client` sono rifiutati.
- Il tenant si risolve dal claim `tenantId` (uuid Bastion) via `Tenant.bastionTenantId`; tenant
  assente, non mappato o `enabled = false` → `403`. Ogni query resta filtrata per `tenantId`
  (`session.tenantId` da `@GetSession()`).
- Il guard fa JIT-upsert dell'admin come riga `User` (FK di `Report.reporterId` / `moderatorId`).

## Gruppi di ruoli

Definiti in `roles.decorator.ts`, applicati con `@Roles(...)` a livello di classe o di metodo
(il metodo sovrascrive la classe). Una rotta **senza** `@Roles` è solo `SUPER_ADMIN`.

| Gruppo | Ruoli | Permesso Bastion/Meridian corrispondente |
|---|---|---|
| `CONTENT_ROLES` | SUPER_ADMIN, ADMIN, MODERATOR, AUTHOR | `articuno-content.*` |
| `MODERATION_ROLES` | SUPER_ADMIN, ADMIN, MODERATOR | `articuno-moderation.manage` |
| `SUPER_ADMIN_ROLES` | SUPER_ADMIN | `articuno-users.manage`, `articuno-config.manage` (nel seed di Bastion non assegnati a nessun ruolo) |

Ogni controller admin usa `@UseGuards(BastionUserGuard, AdminThrottlerGuard)`:
`AdminThrottlerGuard` limita a `THROTTLE_LIMIT` richieste per `THROTTLE_TTL_SECONDS` per utente
Bastion. L'API pubblica (`X-API-Key`, `TenantGuard`) non passa da qui.

## Matrice

Legenda: ✅ ammesso, — negato (`403`).

| Controller | Metodo e path | Gruppo | SUPER_ADMIN | ADMIN | MODERATOR | AUTHOR |
|---|---|---|---|---|---|---|
| Articles | `POST /admin/articles` | CONTENT ¹ | ✅ | ✅ | ✅ | ✅ ¹ |
| | `GET /admin/articles` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `GET /admin/articles/:key` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `PATCH /admin/articles/:id` | CONTENT ¹ | ✅ | ✅ | ✅ | ✅ ¹ |
| | `DELETE /admin/articles/:id` | MODERATION | ✅ | ✅ | ✅ | — |
| | `POST /admin/articles/:id/translations` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `GET /admin/articles/:id/translations` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `GET /admin/articles/:id/translations/:languageCode` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `PATCH /admin/articles/:id/translations/:languageCode` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `DELETE /admin/articles/:id/translations/:languageCode` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| Categories | `POST`, `GET`, `GET /:id`, `PATCH /:id` su `/admin/categories` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `DELETE /admin/categories/:id` | MODERATION | ✅ | ✅ | ✅ | — |
| Tags | `POST`, `GET`, `GET /:id`, `PATCH /:id` su `/admin/tags` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| | `DELETE /admin/tags/:id` | MODERATION | ✅ | ✅ | ✅ | — |
| Stats | `GET /admin/stats/dashboard` | CONTENT | ✅ | ✅ | ✅ | ✅ |
| Comments | `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` su `/admin/comments` | MODERATION | ✅ | ✅ | ✅ | — |
| Reports | `POST`, `GET`, `GET /:id`, `PATCH /:id/status` su `/admin/reports` | MODERATION | ✅ | ✅ | ✅ | — |
| Banned words | `POST`, `GET`, `DELETE /:id` su `/admin/banned-words` | MODERATION | ✅ | ✅ | ✅ | — |
| Users | `GET`, `GET /:id`, `PATCH /:id/status`, `DELETE /:id` su `/admin/users` | SUPER_ADMIN | ✅ | — | — | — |
| Audits | `GET`, `GET /:id` su `/admin/audits` | SUPER_ADMIN | ✅ | — | — | — |
| Webhooks | `GET`, `GET /:id`, `POST /:id/resend`, `POST /resend-all-failed` su `/admin/webhooks` | SUPER_ADMIN | ✅ | — | — | — |

¹ **Stati di moderazione sugli articoli**: in create e update, `canSetArticleStatus()`
(`admin-articles.controller.ts`) consente di portare un articolo **in** o **fuori da**
`UNDER_REVIEW` / `HIDDEN` / `BANNED` solo a `MODERATION_ROLES`. Un AUTHOR può passare fra
`DRAFT` e `PUBLISHED`, ma non può nascondere un articolo né ripubblicarne uno nascosto da un
moderatore → `403`. La transizione resta comunque soggetta a `isValidModerationTransition()`.

## Aggiungere un endpoint admin

1. Controller sotto `src/modules/admin/controllers/` con `@UseGuards(BastionUserGuard, AdminThrottlerGuard)`.
2. `@Roles(...)` esplicito sulla classe e, dove serve, sul metodo; senza, la rotta è SUPER_ADMIN-only.
3. Allineare il permesso `articuno-*` corrispondente in Bastion/Meridian e aggiornare questa matrice.
