# Admin API

## Overview


## Autenticazione

### Login
Prima di utilizzare le API admin, l'amministratore deve effettuare il login:

```http
POST /admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Risposta:**
```json
{
  "ok": true
}
```

Il server imposta un cookie `sessionId` che viene utilizzato automaticamente nelle richieste successive.

### Cookie di Sessione
- **Nome:** `sessionId`
- **HttpOnly:** true
- **SameSite:** lax
- **Secure:** true (in produzione)
- **Path:** /
- **Durata:** 7 giorni

## Endpoints

Tutte le rotte sono sotto `/admin/articles` e richiedono il cookie di sessione valido.

### 1. Creare un Articolo
```http
POST /admin/articles
Cookie: sessionId=<session-id>
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
GET /admin/articles?status=PUBLISHED&categoryId=cat-123&limit=20&offset=0
Cookie: sessionId=<session-id>
```

**Query Parameters:**
- `status`: DRAFT | PUBLISHED | UNDER_REVIEW | HIDDEN | BANNED
- `categoryId`: ID della categoria
- `featured`: true | false
- `tagId`: ID del tag
- `limit`: numero di risultati (default: 20, max: 100)
- `offset`: paginazione offset

### 3. Ottenere un Articolo per Slug
```http
GET /admin/articles/:slug
Cookie: sessionId=<session-id>
```

### 4. Aggiornare un Articolo
```http
PATCH /admin/articles/:id
Cookie: sessionId=<session-id>
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
Cookie: sessionId=<session-id>
```

**Risposta:** `204 No Content`

### 6. Gestione Traduzioni

#### Creare una traduzione
```http
POST /admin/articles/:id/translations
Cookie: sessionId=<session-id>
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
Cookie: sessionId=<session-id>
```

#### Ottenere una traduzione specifica
```http
GET /admin/articles/:id/translations/:languageCode
Cookie: sessionId=<session-id>
```

#### Aggiornare una traduzione
```http
PATCH /admin/articles/:id/translations/:languageCode
Cookie: sessionId=<session-id>
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "<p>Updated content...</p>"
}
```

#### Eliminare una traduzione
```http
DELETE /admin/articles/:id/translations/:languageCode
Cookie: sessionId=<session-id>
```

## Differenze con le API Pubbliche

| Aspetto | API Pubbliche (`/articles`) | API Admin (`/admin/articles`) |
|---------|----------------------------|-------------------------------|
| Autenticazione | Header `X-API-Key` | Cookie `sessionId` |
| Tenant Isolation | Automatica tramite API Key | Automatica tramite sessione |
| Middleware | `TenantMiddleware` + `TenantGuard` | `SessionGuard` |
| Service | `ArticlesService` (riusato) | `ArticlesService` (riusato) |

## Sicurezza

### SessionGuard
Il `SessionGuard` verifica che:
1. Il cookie `sessionId` sia presente
2. La sessione esista nel database
3. La sessione non sia scaduta
4. Aggiorna `lastAccessedAt` ad ogni richiesta

### Gestione Errori
- **401 Unauthorized:** Sessione non trovata, non valida o scaduta
- **404 Not Found:** Risorsa non trovata
- **409 Conflict:** Slug duplicato o violazione di unicità

## Esempio di Utilizzo con cURL

```bash
# 1. Login
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}' \
  -c cookies.txt

# 2. Ottenere gli articoli
curl -X GET http://localhost:3000/admin/articles \
  -b cookies.txt

# 3. Creare un articolo
curl -X POST http://localhost:3000/admin/articles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
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

1. **Tenant Isolation:** Ogni sessione è legata ad un tenant specifico. Tutti i contenuti (articoli, tag, categorie, banned words, reports) sono automaticamente filtrati per `tenantId`.
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

