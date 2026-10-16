# Backlog Articuno

> Stilato il 2026-10-14: tre agenti hanno proposto feature (editoriale, piattaforma, community), un agente critico le ha valutate e un agente verificatore ha controllato nel codice i bug segnalati.
> Su 33 proposte ne sono rimaste 12, con lo scope ridotto al minimo.

## Bug verificati nel codice

| # | Problema | Gravità | Stato |
|---|---|---|---|
| B1 | `GET /articles` e `GET /articles/:slug` restituiscono articoli BANNED/HIDDEN/DRAFT se il tenant non passa `?status`; `ArticleFiltersQueryDto` accetta perfino `status=BANNED` | alta | **Chiuso** — `bc2b424`, `f76c116`: regola `publicArticleStatuses()` su lista, dettaglio, traduzioni, like e bookmark |
| B2 | Delete di un utente con commenti → P2003 / 500 (`comments.authorId` RESTRICT). La FK composita `reports.moderatorId` con `SET NULL` azzera anche `tenantId` (NOT NULL): fallisce anche la delete di un admin con report moderati. P2003 non è mappato e il client riceve 500 | media | **Chiuso** — `4814f1d`: migration `20261014120000_user_delete_foreign_keys`, commenti al placeholder `articuno:deleted`, P2003 → 409 |
| B3 | `slugifySafe` aggiunge un suffisso casuale e lo slug si rigenera a ogni cambio titolo → i vecchi URL vanno in 404 | media | **Chiuso** — slug senza suffisso (`-2`, `-3` solo su collisione), mai rigenerati in update, `slug` modificabile solo da `/admin/*`; gli slug storici restano come sono |
| B4 | `Article.views` non viene mai incrementato: la dashboard mostra 0 e la top 5 ha un ordine arbitrario | media | **Chiuso** — `POST /interactions/articles/:id/view` chiamato dal tenant; manca la chiamata in dbdbuilds-api |
| B5 | Le banned words fanno match per sottostringa (`includes`): "ass" blocca "classe" | media | Aperto (backlog #3) |
| B6 | `webhookSecret` e `fileharborApiKey` sono salvati in chiaro su `tenants` | media | Aperto, rimandato: cifratura a riposo col pattern di Herald |
| B7 | `Tenant.defaultLanguage` non viene mai letto; `'it'` è hardcoded in `articles.service.ts` | bassa | Aperto (backlog #8) |
| B8 | `applyCreationPolicy` restituisce `VISIBLE` per un utente BANNED; il caso si verifica solo se il ban arriva fra le due query di `comments.service.ts` | bassa | Aperto |
| B9 | `AuditLog` non ha nessun job di retention | bassa | Aperto, rimandato |

## Backlog in ordine di priorità

Il punto 6 aggiunge `publishedAt` alle risposte, ordina `GET /articles` per `publishedAt` ed emette `article.published` (con `firstPublication`), `article.unpublished`, `article.deleted` nella stessa transazione del cambio (§8 della guida di integrazione). Migration `20261016120000_article_published_at`: backfill `publishedAt = createdAt` per gli articoli `PUBLISHED`/`UNDER_REVIEW`.

Il punto 1 è già rilasciato come breaking change (contratto nel §5.1 della [guida di integrazione di piattaforma](../../docs/integrations/articuno.md)): avvisare i tenant prima del deploy. I punti 5 e 6 modificano anch'essi il contratto pubblico: rilasciarli insieme, con una nota nella guida di integrazione, senza introdurre il versioning negli URI.

| # | Voce | Costo | Scope minimo | Fuori scope (prima iterazione) |
|---|---|---|---|---|
| 1 | ✅ **API pubblica filtrata per stato** (B1) — fatto | S | PUBLISHED di default, DRAFT solo con `includeDrafts=true`, mai UNDER_REVIEW/HIDDEN/BANNED | Preview token HMAC |
| 2 | ✅ **Fix integrità delle delete** (B2) — fatto | S | FK dei commenti, FK composita dei report, CASCADE da tenant su reports e banned_words, P2003 → 409 | Export GDPR, offboarding/import del tenant |
| 3 | **Banned words con match per parola intera** (B5) | S | Confini di parola, normalizzazione Unicode e accenti, test di regressione su "classe" | Regex dei tenant (rischio ReDoS), leetspeak, azioni FLAG/HIDE/REJECT |
| 4 | ✅ **Webhook idempotenti** — fatto | S | Standard Webhooks: `webhook-id` (id del `WebhookEvent`), `webhook-timestamp`, firma su `id.timestamp.body`, documentati | Rotazione con doppio secret, nonce store |
| 5 | ✅ **Slug stabili** (B3) — fatto | S | Slug generato una volta, suffisso solo in caso di collisione, nessuna rigenerazione al cambio titolo, slug modificabile dall'admin | Tabella storico slug e redirect |
| 6 | ✅ **`publishedAt` + eventi di contenuto** — fatto | S/M | `publishedAt` impostato alla prima pubblicazione, sort per `publishedAt`, eventi outbox `article.published`/`unpublished`/`deleted` nella stessa `tx` | Endpoint webhook multipli per tenant, filtri, eventi sui commenti |
| 7 | **Configurazione tenant da admin** | S/M | `GET`/`PATCH /admin/tenant` (SUPER_ADMIN) per webhookUrl, rigenerazione del secret, credenziali FileHarbor, defaultLanguage; `POST /admin/tenant/rotate-api-key`; nuove AuditAction | CRUD multi-tenant, più chiavi o scope (per ruotare senza downtime c'è già il JWT service-client di Bastion) |
| 8 | **Fallback sulla lingua di default** (B7) | S | Usa `tenant.defaultLanguage` quando manca `languageCode` e aggiunge il flag `isFallback` | Catene di fallback, hreflang (gli alternates sono già in risposta) |
| 9 | **Policy di moderazione per tenant** | S | Soglie dei report come colonne di Tenant, `Article.commentsLocked` | Modalità PREMODERATED/CLOSED (richiedono un nuovo stato nella FSM) |
| 10 | **Osservabilità minima** | S | Rispettare l'`x-request-id` in ingresso, `articuno_job_last_success_timestamp{job}` | OpenTelemetry, label `tenant` sulle metriche HTTP |
| 11 | ✅ **Views affidabili** (B4) — fatto | S | `POST /interactions/articles/:id/view` chiamato dal tenant, increment atomico (non tocca `updatedAt`); `DailyStats.totalViews` resta 0 (serve uno snapshot del totale) | Tabella giornaliera, articoli correlati, dedup dei visitatori |
| 12 | **Pubblicazione programmata** (dopo #6) | M | `scheduledAt`, cron ogni minuto con `UPDATE … RETURNING` condizionale, passaggio da `isValidModerationTransition`, evento nella `tx` | Unpublish programmato |

## Da riprendere solo su richiesta di un tenant

- Ricerca full-text (tsvector + GIN)
- Commenti in thread
- Ban temporanei con motivo e scadenza
- Nomi localizzati per categorie e tag
- Upload di immagini nel corpo dell'articolo verso il FileHarbor del tenant
- `updatedSince` sulle liste
- SDK `@heyatom/articuno-client` generato da OpenAPI (`scripts/openapi-dump.ts` esiste già)
- Azioni bulk nella moderazione

## Scartate

| Proposta | Motivo |
|---|---|
| Rate-limit e anti-spam per utente | Contraddice `283f9b9`: il rate-limit è delegato ai tenant e l'`externalUserId` lo fornisce il tenant |
| Notifiche agli utenti finali e ai moderatori via Herald | Il sistema di notifiche è stato appena rimosso perché non lo usava nessuno (`8e341cb`). Il segnale arriva già via webhook e metriche; al massimo un badge in Meridian |
| Export GDPR dei dati utente, appelli alle decisioni di moderazione | Il titolare dei dati e degli utenti è il tenant |
| ETag/Cache-Control, delta sync con tombstone | Li gestisce il layer di cache del tenant; bastano gli eventi (#6) più `updatedSince` |
| Canonical/noIndex/ogImage, dati per sitemap/feed | Li decide il sito; metaTitle, metaDescription e coverImage esistono già |
| Più API key per tenant con scope e grace period | Le credenziali machine-to-machine sono compito di Bastion |
| Trust level e reputazione, reazioni ai commenti | Speculativi con pochi utenti per tenant; rendono la policy opaca |
| Workflow editoriale (submit/approve, assegnatari, note), revisioni dei contenuti | Funzioni da redazione enterprise; i ruoli di Bastion bastano |
| Cache LRU per la risoluzione del tenant | Risparmia una query su indice univoco e introduce un problema di invalidazione |
| Tassonomie gerarchiche e multi-categoria | YAGNI e breaking su `categoryId` |
| Versioning delle API negli URI, OpenTelemetry | Sproporzionati con un solo tipo di consumatore |
| Export/import/offboarding del tenant | Basta la correzione delle FK (#2) |
| Coda di moderazione con claim | Con 1–2 moderatori il claim non serve |
