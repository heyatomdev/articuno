# Admin API

## Overview


## Autenticazione

### Token Bastion

Articuno non ha un login proprio: l'amministratore si autentica su **Bastion** (di norma
attraverso la console Meridian) e inoltra il proprio user-JWT a ogni richiesta.

```http
Authorization: Bearer <bastion-user-jwt>
```

`BastionUserGuard` verifica firma RS256 contro la JWKS di Bastion (in cache), scadenza,
`appSlug` fra `ADMIN_ACCEPTED_APP_SLUGS` e ruolo fra `ADMIN_ACCEPTED_ROLES`. Il tenant
Articuno è risolto dal claim `tenantId` (uuid Bastion) via `Tenant.bastionTenantId`.

Nessuna sessione lato server: niente cookie, niente scadenza da gestire in Articuno.

## Endpoints

Tutte le rotte sono sotto `/admin/articles` e richiedono un token Bastion valido.

### 1. Creare un Articolo
```http
POST /admin/articles
Authorization: Bearer <bastion-user-jwt>
Content-Type: application/json

{
  "categoryId": "cat-123",
  "authorId": "user-456",
  "coverImage": "https://example.com/cover.jpg",
  "status": "DRAFT",
  "featured": false,
  "tagIds": ["tag-1", "tag-2"],
  "translations": [
    {
      "languageCode": "it",
      "title": "Titolo dell'articolo",
      "slug": "titolo-articolo",
      "content": "<p>Contenuto...</p>",
      "excerpt": "Breve descrizione"
    }
  ]
}
```

### 2. Ottenere tutti gli Articoli
```http
GET /admin/articles?status=PUBLISHED&categoryId=cat-123&page=1&limit=20
Authorization: Bearer <bastion-user-jwt>
```

**Query Parameters:**
- `status`: DRAFT | PUBLISHED | UNDER_REVIEW | HIDDEN | BANNED
- `categoryId`: ID della categoria
- `featured`: true | false
- `tagId`: ID del tag
- `page`: numero di pagina, 1-based (default: 1)
- `limit`: numero di risultati per pagina (default: 20, max: 100)

### 3. Ottenere un Articolo per Slug
```http
GET /admin/articles/:slug
Authorization: Bearer <bastion-user-jwt>
```

### 4. Aggiornare un Articolo
```http
PATCH /admin/articles/:id
Authorization: Bearer <bastion-user-jwt>
Content-Type: application/json

{
  "status": "PUBLISHED",
  "featured": true,
  "coverImage": "https://example.com/new-cover.jpg"
}
```

### 5. Eliminare un Articolo
```http
DELETE /admin/articles/:id
Authorization: Bearer <bastion-user-jwt>
```

**Risposta:** `204 No Content`

### 6. Gestione Traduzioni

#### Creare una traduzione
```http
POST /admin/articles/:id/translations
Authorization: Bearer <bastion-user-jwt>
Content-Type: application/json

{
  "languageCode": "en",
  "title": "Article Title",
  "slug": "article-title",
  "content": "<p>Content...</p>",
  "excerpt": "Short description"
}
```

#### Ottenere tutte le traduzioni
```http
GET /admin/articles/:id/translations
Authorization: Bearer <bastion-user-jwt>
```

#### Ottenere una traduzione specifica
```http
GET /admin/articles/:id/translations/:languageCode
Authorization: Bearer <bastion-user-jwt>
```

#### Aggiornare una traduzione
```http
PATCH /admin/articles/:id/translations/:languageCode
Authorization: Bearer <bastion-user-jwt>
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "<p>Updated content...</p>"
}
```

#### Eliminare una traduzione
```http
DELETE /admin/articles/:id/translations/:languageCode
Authorization: Bearer <bastion-user-jwt>
```

## Differenze con le API Pubbliche

| Aspetto | API Pubbliche (`/articles`) | API Admin (`/admin/articles`) |
|---------|----------------------------|-------------------------------|
| Autenticazione | Header `X-API-Key` | Header `Authorization: Bearer` |
| Tenant Isolation | Automatica tramite API Key | Automatica tramite claim `tenantId` |
| Middleware | `TenantMiddleware` + `TenantGuard` | `BastionUserGuard` |
| Service | `ArticlesService` (riusato) | `ArticlesService` (riusato) |

## Sicurezza

### BastionUserGuard
Il `BastionUserGuard` verifica che:
1. L'header `Authorization: Bearer` sia presente
2. La firma RS256 sia valida contro la JWKS di Bastion e il token non sia scaduto
3. Il token sia di un utente, non un `service_client`
4. `appSlug` e ruolo siano fra quelli accettati
5. Esista un tenant Articuno con quel `bastionTenantId`

### Gestione Errori
- **401 Unauthorized:** token assente, non valido, scaduto, o tenant non mappato
- **404 Not Found:** Risorsa non trovata
- **409 Conflict:** Slug duplicato o violazione di unicità

## Esempio di Utilizzo con cURL

```bash
# 1. Ottenere un token: login su Bastion (o riuso di quello della console)
TOKEN=<bastion-user-jwt>

# 2. Ottenere gli articoli
curl -X GET http://localhost:3000/admin/articles \
  -H "Authorization: Bearer $TOKEN"

# 3. Creare un articolo
curl -X POST http://localhost:3000/admin/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "categoryId": "cat-123",
    "translations": [
      {
        "languageCode": "it",
        "title": "Nuovo Articolo",
        "slug": "nuovo-articolo",
        "content": "<p>Contenuto del nuovo articolo</p>"
      }
    ]
  }'
```

## Note Importanti

1. **Tenant Isolation:** Ogni token è legato a un tenant specifico. Tutti i contenuti (articoli, tag, categorie, banned words, reports) sono automaticamente filtrati per `tenantId`.
2. **Banned Words:** Il sistema controlla automaticamente le parole bannate nelle traduzioni degli articoli e nei commenti. I contenuti con parole bannate vengono impostati su `HIDDEN`.
3. **Slug Uniqueness:** 
   - Gli slug degli articoli devono essere unici per tenant e lingua (`@@unique([tenantId, slug])`)
   - Gli slug dei tag devono essere unici per tenant
   - Gli slug delle categorie devono essere unici per tenant
4. **Content Sanitization:** Tutto il contenuto HTML degli articoli viene sanitizzato automaticamente.
5. **Webhook Events:** Le modifiche di stato degli articoli e commenti generano eventi webhook per sistemi esterni.
6. **Auto-moderation:**
   - **Report Thresholds:** Quando un contenuto raggiunge la soglia di segnalazioni (5 per commenti, 10 per articoli), viene automaticamente nascosto o messo sotto revisione
   - **Banned Words Detection:** Contenuto con parole bannate viene automaticamente nascosto
7. **Report Status Flow:**
   - `PENDING` → `REVIEWED` → `RESOLVED` (violazione confermata) / `DISMISSED` (falso positivo)
   - Status `RESOLVED` banna permanentemente il contenuto
   - Status `DISMISSED` ripristina la visibilità se non ci sono altre segnalazioni attive
8. **Analytics:** Le statistiche sono aggregate giornalmente dal job schedulato `AnalyticsJob`
9. **Conteggi Articoli:** Le risposte di tag e categorie includono il conteggio degli articoli associati (`articlesCount` o `_count.articles`)
   - **Banned Words Detection:** Contenuto con parole bannate viene automaticamente nascosto
7. **Report Status Flow:**
   - `PENDING` → `REVIEWED` → `RESOLVED` (violazione confermata) / `DISMISSED` (falso positivo)
   - Status `RESOLVED` banna permanentemente il contenuto
   - Status `DISMISSED` ripristina la visibilità se non ci sono altre segnalazioni attive
8. **Analytics:** Le statistiche sono aggregate giornalmente dal job schedulato `AnalyticsJob`

