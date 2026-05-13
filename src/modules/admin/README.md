# Admin Module

## Struttura

Il modulo Admin fornisce API per la gestione dei contenuti (articoli, tag, categorie) da parte degli amministratori autenticati tramite sessione, bypassando il sistema di API Key multi-tenant.

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
- **Import:** PrismaModule, ArticlesModule, TagsModule, CategoriesModule, AuthModule
- **Controllers:** AdminArticlesController, AdminTagsController, AdminCategoriesController
- **Pattern:** Riusa i servizi esistenti (ArticlesService, TagsService, CategoriesService)

### Controller

Ogni controller:
1. Usa `@UseGuards(SessionGuard)` per l'autenticazione basata su sessione
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

### SessionGuard
Posizione: `src/modules/auth/guards/session.guard.ts`

**Funzionalità:**
1. Estrae il cookie `sessionId` dalla richiesta
2. Verifica l'esistenza della sessione nel database
3. Verifica che la sessione non sia scaduta
4. Aggiorna `lastAccessedAt` ad ogni richiesta
5. Allega i dati della sessione a `request.session`

**Eccezioni:**
- `401 Unauthorized`: Sessione non trovata, non valida o scaduta

### GetSession Decorator
Posizione: `src/modules/auth/decorators/get-session.decorator.ts`

Estrae i dati della sessione dalla richiesta (aggiunta da SessionGuard).

**Dati disponibili:**
```typescript
{
  id: string;           // Session ID
  userId: string;       // Admin User ID
  tenantId: string;     // Tenant ID (per isolamento)
  userRole: UserRole;   // Ruolo utente
  externalId: string;   // External ID utente
  expiresAt: Date;      // Scadenza sessione
  // ... altri campi
}
```

## Flusso di Autenticazione

```
1. Admin effettua login: POST /admin/auth/login
   ↓
2. AuthService crea sessione in SessionStorage
   ↓
3. Cookie sessionId impostato nel browser
   ↓
4. Admin chiama API: GET /admin/articles
   ↓
5. SessionGuard valida sessione
   ↓
6. Dati sessione allegati a request
   ↓
7. Controller estrae tenantId tramite @GetSession()
   ↓
8. Service esegue query filtrata per tenantId
   ↓
9. Risposta al client
```

## Differenze con API Pubbliche

| Aspetto               | API Pubbliche                       | API Admin                                             |
|-----------------------|-------------------------------------|-------------------------------------------------------|
| **Path**              | `/articles`, `/tags`, `/categories` | `/admin/articles`, `/admin/tags`, `/admin/categories` |
| **Autenticazione**    | Header `X-API-Key`                  | Cookie `sessionId`                                    |
| **Guard**             | `TenantGuard`                       | `SessionGuard`                                        |
| **Middleware**        | `TenantMiddleware`                  | Nessuno (SessionGuard gestisce)                       |
| **Tenant Extraction** | Da API Key hashata                  | Da sessione                                           |
| **User Context**      | Header `X-User-Id` (opzionale)      | Da sessione (sempre presente)                         |
| **Use Case**          | Client esterni (frontend pubblico)  | Admin panel/dashboard                                 |

## Vantaggi

1. **Riuso del Codice:** I servizi esistenti vengono riutilizzati senza duplicazione di logica
2. **Sicurezza:** Sessioni gestite server-side con scadenza automatica
3. **Isolamento Tenant:** Mantenuto anche per gli admin tramite `session.tenantId`
4. **Consistenza:** Stesse validazioni, sanitizzazione e moderazione delle API pubbliche
5. **Tracciabilità:** `lastAccessedAt` aggiornato automaticamente
6. **Moderation Tools:** Accesso completo a banned words, reports e analytics

## Note di Implementazione

1. **Cookie de-serializer:** `cookie-parser` middleware già configurato in `main.ts`
2. **CORS:** Configurato con `credentials: true` per permettere cookies cross-origin
3. **SessionStorage:** Modello Prisma con indici su `id`, `userId`, `expiresAt`
4. **TTL Sessione:** 7 giorni (configurabile in `AuthService`)
5. **Cleanup Sessioni:** Job schedulato implementato in `AuthJob` (elimina sessioni scadute ogni ora + sessioni inattive ogni giorno)

## Estensibilità

Per aggiungere nuove risorse admin:

```typescript
// 1. Creare controller in src/modules/admin/controllers/
@Controller('admin/resource')
@UseGuards(SessionGuard)
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

- [x] Implementare job schedulato per cleanup sessioni scadute (✅ Implementato in `AuthJob`)
- [x] Aggiungere logout endpoint: `DELETE /admin/auth/logout` (✅ Implementato)
- [x] Implementare refresh sessione: `POST /admin/auth/refresh` (✅ Implementato)
- [ ] Aggiungere validazione role-based per operazioni critiche
- [ ] Implementare audit log per operazioni admin
- [ ] Aggiungere rate limiting specifico per endpoint admin

