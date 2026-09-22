# Admin Module

## Struttura

Il modulo Admin fornisce API per la gestione dei contenuti (articoli, tag, categorie) da parte degli amministratori autenticati con un user-JWT Bastion, bypassando il sistema di API Key multi-tenant.

```
src/modules/admin/
├── admin.module.ts
└── controllers/
    ├── admin-articles.controller.ts
    ├── admin-tags.controller.ts
    └── admin-categories.controller.ts
```

## Componenti

### AdminModule
- **Import:** PrismaModule, ArticlesModule, TagsModule, CategoriesModule, BastionModule
- **Controllers:** AdminArticlesController, AdminTagsController, AdminCategoriesController
- **Pattern:** Riusa i servizi esistenti (ArticlesService, TagsService, CategoriesService)

### Controller

Ogni controller:
1. Usa `@UseGuards(BastionUserGuard, AdminThrottlerGuard)` — Bastion user-JWT (RS256, verificato via JWKS)
2. Usa `@GetSession()` decorator per estrarre i dati della sessione
3. Estrae `session.tenantId` per mantenere l'isolamento multi-tenant
4. Delega la logica di business ai servizi esistenti

#### AdminArticlesController
- **Rotta base:** `/admin/articles`
- **Service:** ArticlesService (riusato)
- **Endpoints:** CRUD completo + gestione traduzioni

#### AdminTagsController
- **Rotta base:** `/admin/tags`
- **Service:** TagsService (riusato)
- **Endpoints:** CRUD completo

#### AdminCategoriesController
- **Rotta base:** `/admin/categories`
- **Service:** CategoriesService (riusato)
- **Endpoints:** CRUD completo

## Autenticazione

### BastionUserGuard
Posizione: `src/modules/bastion/guards/bastion-user.guard.ts`

Unico guard di `/admin/*`. Verifica la firma RS256 del token contro la JWKS di Bastion
(in cache, nessuna chiamata per request), rifiuta i token `service_client`, e controlla
`appSlug` e ruolo contro `ADMIN_ACCEPTED_APP_SLUGS` / `ADMIN_ACCEPTED_ROLES`.

Risolve il `Tenant` Articuno dal claim `tenantId` (uuid Bastion) via
`Tenant.bastionTenantId`, e fa JIT-upsert dell'admin come riga `User` — serve perché
`Report.reporterId` / `Report.moderatorId` sono FK reali su `users(externalId, tenantId)`.

**Eccezioni:**
- `401 Unauthorized`: token assente, firma non valida, scaduto, `appSlug` o ruolo non accettati
- `401 Unauthorized`: nessun tenant Articuno con quel `bastionTenantId`

### GetSession Decorator
Posizione: `src/modules/bastion/decorators/get-session.decorator.ts`

Estrae da `request.session` i dati che `BastionUserGuard` ci ha allegato.

**Dati disponibili** (`AdminSession` in `src/modules/bastion/bastion.types.ts`):
```typescript
{
  tenantId: string;     // Tenant Articuno (per isolamento)
  externalId: string;   // `sub` Bastion dell'admin
  userRole: string;     // Ruolo Bastion, stringa libera (non l'enum UserRole)
}
```

## Flusso di Autenticazione

```
1. L'admin fa login su Meridian, che parla con Bastion
   ↓
2. Meridian inoltra il proprio user-JWT: Authorization: Bearer <token>
   ↓
3. BastionUserGuard verifica firma/scadenza/appSlug/ruolo via JWKS in cache
   ↓
4. Risolve il tenant su Tenant.bastionTenantId e fa JIT-upsert della riga User
   ↓
5. AdminSession allegata a request.session
   ↓
6. Controller estrae tenantId tramite @GetSession()
   ↓
7. Service esegue query filtrata per tenantId
   ↓
8. Risposta al client
```

## Differenze con API Pubbliche

| Aspetto               | API Pubbliche                       | API Admin                                             |
|-----------------------|-------------------------------------|-------------------------------------------------------|
| **Path**              | `/articles`, `/tags`, `/categories` | `/admin/articles`, `/admin/tags`, `/admin/categories` |
| **Autenticazione**    | Header `X-API-Key`                  | Header `Authorization: Bearer` (JWT Bastion)          |
| **Guard**             | `TenantGuard`                       | `BastionUserGuard`                                    |
| **Middleware**        | `TenantMiddleware`                  | Nessuno (il guard gestisce)                           |
| **Tenant Extraction** | Da API Key hashata                  | Da `Tenant.bastionTenantId` + claim `tenantId`        |
| **User Context**      | Header `X-User-Id` (opzionale)      | Dal claim `sub` (sempre presente)                     |
| **Use Case**          | Client esterni (frontend pubblico)  | Admin panel/dashboard                                 |

## Vantaggi

1. **Riuso del Codice:** I servizi esistenti vengono riutilizzati senza duplicazione di logica
2. **Sicurezza:** Nessuna credenziale admin in Articuno — l'IdP è Bastion
3. **Isolamento Tenant:** Mantenuto anche per gli admin tramite `session.tenantId`
4. **Consistenza:** Stesse validazioni, sanitizzazione e moderazione delle API pubbliche
5. **Tracciabilità:** `AuditLog` su ogni operazione che cambia stato
6. **Moderation Tools:** Accesso completo a banned words, reports e analytics

## Note di Implementazione

1. **Stateless:** nessuna sessione in DB, quindi niente cookie, niente cleanup schedulato
2. **CORS:** solo header (`Authorization`), nessun `credentials: true`
3. **JWKS:** chiave pubblica Bastion in cache (`BASTION_JWKS_TTL_MS`, default 1h)
4. **TTL:** deciso da Bastion, Articuno legge solo `exp`
5. **Rate limit:** `AdminThrottlerGuard` bucketta sul `sub` Bastion, non sull'IP

## Estensibilità

Per aggiungere nuove risorse admin:

```typescript
// 1. Creare controller in src/modules/admin/controllers/
@Controller('admin/resource')
@UseGuards(BastionUserGuard, AdminThrottlerGuard)
export class AdminResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  findAll(@GetSession() session: any) {
    return this.resourceService.findAll(session.tenantId);
  }
  // ... altri endpoint
}

// 2. Aggiornare AdminModule
@Module({
  imports: [..., ResourceModule],
  controllers: [..., AdminResourceController],
})
export class AdminModule {}
```

## TODO

- [x] Rate limiting specifico per endpoint admin (`AdminThrottlerGuard`)
- [x] Audit log per operazioni admin (`AuditLoggerService`)
- [ ] Enforcement dei permessi fine lato servizio: oggi vive solo nel BFF di Meridian

