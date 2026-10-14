# Guida integrazione BE NestJS con Articuno

Questa guida e pensata per un backend NestJS esterno che deve integrare Articuno per:
- leggere/scrivere articoli
- gestire categorie
- ottenere tags
- gestire commenti
- gestire report
- usare interactions (like/bookmark/stato)
- aggiungere banned words

> Nota: i tag si ottengono via API `GET /tags`. L'associazione dei tag agli articoli avviene tramite `tagIds` nel payload articolo.

## 1) Prerequisiti

- Tenant Articuno attivo
- `X-API-Key` del tenant
- Base URL del servizio Articuno (es. `http://localhost:3000`)

## 2) Configurazione env nel BE NestJS esterno

Esempio `.env`:

```env
ARTICUNO_BASE_URL=http://localhost:3000
ARTICUNO_TENANT_API_KEY=your-tenant-api-key
ARTICUNO_TIMEOUT_MS=8000
```

Header obbligatorio su quasi tutte le chiamate:

- `X-API-Key: <ARTICUNO_TENANT_API_KEY>`

Header aggiuntivo richiesto per `interactions`:

- `X-User-Id: <external-user-id>`

## 3) Client HTTP consigliato (NestJS)

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ArticunoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('ARTICUNO_BASE_URL');
    this.apiKey = this.config.getOrThrow<string>('ARTICUNO_TENANT_API_KEY');
  }

  private get headers() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const res = await firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${path}`, {
        headers: this.headers,
        params,
      }),
    );
    return res.data;
  }

  async post<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const res = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${path}`, body, {
        headers: { ...this.headers, ...extraHeaders },
      }),
    );
    return res.data;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(
      this.http.patch<T>(`${this.baseUrl}${path}`, body, {
        headers: this.headers,
      }),
    );
    return res.data;
  }

  async delete(path: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers: this.headers,
      }),
    );
  }
}
```

## 4) Endpoints da integrare

## Articoli (CRUD + traduzioni)

Base: `/articles`

- `POST /articles`
- `GET /articles`
- `GET /articles/:slug`
- `PATCH /articles/:id`
- `DELETE /articles/:id`

Traduzioni:
- `POST /articles/:id/translations`
- `GET /articles/:id/translations`
- `GET /articles/:id/translations/:languageCode`
- `PATCH /articles/:id/translations/:languageCode`
- `DELETE /articles/:id/translations/:languageCode`

### Payload minimo creazione articolo

```json
{
  "categoryId": "<uuid>",
  "tagIds": ["<uuid-tag-1>", "<uuid-tag-2>"],
  "translations": [
    {
      "languageCode": "it",
      "title": "Titolo",
      "content": "Contenuto articolo",
      "excerpt": "Estratto",
      "slug": "titolo-articolo"
    }
  ]
}
```

`tagIds` deve essere valorizzato usando gli ID recuperati da `GET /tags`.

### Visibilità per stato (breaking change, ottobre 2026)

`GET /articles` e `GET /articles/:slug` restituiscono **solo articoli `PUBLISHED`**.

| Stato | Default | `includeDrafts=true` |
|---|---|---|
| `PUBLISHED` | sì | sì |
| `DRAFT` | no | sì |
| `UNDER_REVIEW`, `HIDDEN`, `BANNED` | mai | mai |

- `includeDrafts=true` serve all'anteprima delle bozze nel sito del tenant: non inoltrarlo dal client pubblico.
- `GET /articles/:slug` su un articolo non visibile risponde `404`, come per uno slug inesistente.
- Prima del cambio, senza `status` la lista restituiva articoli in **ogni** stato (anche moderati) e il dettaglio non filtrava lo stato.

**Migrazione:**
- `status=UNDER_REVIEW|HIDDEN|BANNED` ora risponde `400` (validazione). Gli articoli moderati si leggono solo da `/admin/articles` (Bastion).
- `status=DRAFT` richiede `includeDrafts=true`, altrimenti `400`.
- `status=PUBLISHED` continua a funzionare ed equivale al default: si può togliere.
- Se il BE mostrava bozze in anteprima, aggiungere `includeDrafts=true` a lista e dettaglio.

**Stessa regola sugli endpoint che leggono un articolo per id:**

| Endpoint | Articolo non `PUBLISHED` |
|---|---|
| `GET /articles/:id/translations`, `GET /articles/:id/translations/:languageCode` | `404`; con `includeDrafts=true` anche `DRAFT` è visibile |
| `POST /interactions/articles/:articleId/like`, `GET /interactions/articles/:articleId/status` | `404` (anche per le bozze) |
| `POST /bookmarks/:articleId` | `404` (anche per le bozze) |
| `GET /bookmarks/me` | i segnalibri di articoli non `PUBLISHED` sono esclusi dalla lista |

Le scritture sulle traduzioni (`POST`/`PATCH`/`DELETE /articles/:id/translations…`) restano possibili su articoli in qualunque stato.

### Filtri `GET /articles`

- `status`: `PUBLISHED | DRAFT` (opzionale, restringe il risultato; `DRAFT` richiede `includeDrafts=true`)
- `includeDrafts`: `true | false` (default `false`)
- `categoryId`: UUID
- `tagId`: UUID
- `languageCode`: codice BCP 47
- `featured`: `true | false`

### Query `GET /articles/:slug`

- `languageCode`: codice BCP 47
- `includeDrafts`: `true | false` (default `false`)

---

## Categorie (CRUD)

Base: `/categories`

- `POST /categories`
- `GET /categories`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

Payload create:

```json
{
  "name": "Tech",
  "slug": "tech",
  "description": "Categoria tecnologia",
  "color": "#3B82F6"
}
```

---

## Tags (lettura)

Base: `/tags`

- `GET /tags`

Usa questo endpoint per ottenere la lista tag e poi passare gli ID in `tagIds` su `/articles`.

---

## Commenti (CRUD)

Base: `/comments`

- `POST /comments`
- `GET /comments`
- `GET /comments/:id`
- `PATCH /comments/:id`
- `DELETE /comments/:id`

Payload create:

```json
{
  "articleId": "<uuid-articolo>",
  "content": "Testo commento",
  "authorExternalId": "user-123"
}
```

Filtro disponibile su `GET /comments`:
- `articleId=<uuid-articolo>`

---

## Interactions (like/bookmark/stato)

Base: `/interactions`

- `POST /interactions/articles/:articleId/like`
- `GET /interactions/articles/:articleId/status`

Segnalibri (base `/bookmarks`):

- `POST /bookmarks/:articleId` (toggle)
- `GET /bookmarks/me`

> Obbligatorio: header `X-User-Id` su tutte le endpoint interactions e bookmarks.
> Solo articoli `PUBLISHED`: su qualunque altro stato rispondono `404`.

Esempio:

```bash
curl -X POST "$ARTICUNO_BASE_URL/interactions/articles/<articleId>/like" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY" \
  -H "X-User-Id: user-123"
```

---

## Report (CRUD operativo)

Base: `/reports`

- `POST /reports` (creazione report)
- `GET /reports` (lista, filtro opzionale `status`)
- `PATCH /reports/:id/status` (aggiornamento stato moderazione)

Payload `POST /reports`:

```json
{
  "targetType": "ARTICLE",
  "targetId": "<id-target>",
  "reason": "Spam",
  "description": "Dettaglio opzionale",
  "reporterId": "user-123"
}
```

`targetType` ammessi: `ARTICLE | COMMENT | USER`

Payload `PATCH /reports/:id/status`:

```json
{
  "status": "RESOLVED",
  "moderatorNote": "Gestito dal team",
  "moderatorId": "mod-1"
}
```

---

## Banned words

Base: `/banned-words`

- `POST /banned-words`
- `GET /banned-words`
- `DELETE /banned-words/:id`

Payload create:

```json
{
  "word": "parola_vietata"
}
```

## 5) Esempi rapidi cURL

Creazione categoria:

```bash
curl -X POST "$ARTICUNO_BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY" \
  -d '{
    "name": "News",
    "slug": "news"
  }'
```

Creazione articolo con tag associati:

```bash
curl -X POST "$ARTICUNO_BASE_URL/articles" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY" \
  -d '{
    "categoryId": "<uuid-category>",
    "tagIds": ["<uuid-tag-1>", "<uuid-tag-2>"],
    "translations": [
      {
        "languageCode": "it",
        "title": "Articolo demo",
        "content": "Contenuto demo",
        "excerpt": "Estratto demo",
        "slug": "articolo-demo"
      }
    ]
  }'
```

Lista articoli pubblicati (default, `status` non serve):

```bash
curl "$ARTICUNO_BASE_URL/articles" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY"
```

Anteprima di una bozza:

```bash
curl "$ARTICUNO_BASE_URL/articles/titolo-articolo?includeDrafts=true" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY"
```

Lista tag:

```bash
curl "$ARTICUNO_BASE_URL/tags" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY"
```

Aggiunta banned word:

```bash
curl -X POST "$ARTICUNO_BASE_URL/banned-words" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ARTICUNO_TENANT_API_KEY" \
  -d '{"word": "spoiler"}'
```

## 6) Note operative

- Tutte le chiamate sono tenant-scoped tramite `X-API-Key`.
- Per `interactions`, senza `X-User-Id` viene restituito `400`.
- I tag si leggono con `GET /tags` e si associano agli articoli via `tagIds`.
- Il BE esterno deve integrare Articuno solo via HTTP API: nessuna invocazione DB/Prisma sugli articoli.
- In ambiente di test, puoi usare Swagger su `/docs` del servizio Articuno per verificare payload e risposte.

