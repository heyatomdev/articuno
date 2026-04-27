# Multi-Tenant Blog Platform con Prisma

Sistema completo per gestire blog/news multi-tenant con tutte le funzionalità social.

## 🚀 Funzionalità Implementate

### Core Features
- ✅ **Multi-tenancy** - Isolamento completo per ogni tenant (3 blog indipendenti)
- ✅ **Gestione Articoli** - Draft, pubblicazione, featured, SEO metadata
- ✅ **Categorie e Tags** - Organizzazione flessibile dei contenuti
- ✅ **Like e Bookmarks** - Interazioni utente con contatori denormalizzati
- ✅ **Sistema Commenti** - Commenti nidificati con replies
- ✅ **Moderazione** - Stati commenti, report, review workflow
- ✅ **Notifiche** - Sistema completo per like, commenti, follow
- ✅ **User Roles** - Admin, Editor, Author, Subscriber
- ✅ **Analytics** - Views tracking, statistiche giornaliere
- ✅ **Search** - Full-text search su articoli
- ✅ **Social** - Follow utenti, profili
- ✅ **Versioning** - Storia revisioni articoli
- ✅ **Sessions** - Gestione autenticazione

## 📊 Schema Database

### Entità Principali

**Tenant** → Ogni blog è un tenant separato
- Domain e slug univoci
- Configurazioni personalizzabili
- Statistiche aggregate

**User** → Utenti isolati per tenant
- Ruoli: Admin, Editor, Author, Subscriber
- Profilo completo con bio, avatar
- Email verification

**Article** → Contenuti
- Stati: Draft, Pending Review, Published, Archived
- SEO metadata completo
- Contatori denormalizzati per performance
- Supporto featured articles

**Category & Tag** → Organizzazione
- Categorie gerarchiche (parent/child)
- Tags flat
- Colori personalizzabili

### Features Sociali

**Like** → Mi piace su articoli
**Bookmark** → Salva per dopo (con note private)
**Comment** → Commenti nidificati
**UserFollow** → Follow tra utenti
**Notification** → Sistema notifiche real-time ready

### Moderazione

**Report** → Segnalazioni
- Su commenti, articoli, utenti
- Stati: Pending, Reviewed, Resolved, Dismissed
- Workflow completo di review



Gestione Articoli (Public/Read)

Queste API servono al tuo frontend per mostrare i contenuti.

    GET /articles: Lista paginata di articoli (filtri: categoria, tag, search).

    GET /articles/:slug: Dettaglio articolo (include traduzioni, autore e statistiche).

    GET /categories: Elenco delle categorie disponibili per il tenant.

    GET /tags: Cloud dei tag utilizzati.

2. Interazioni Utente (Write/Authenticated via Proxy)

In queste chiamate, il sito principale deve passare l'ID dell'utente nel corpo della richiesta o negli header (es. x-user-id).

    POST /articles/:id/like: Toggle del like (se esiste lo toglie, se non esiste lo mette).

    POST /articles/:id/bookmark: Toggle del salvataggio nei preferiti.

    POST /articles/:id/comments: Crea un nuovo commento.

    DELETE /comments/:id: Elimina un commento (il microservizio verifica che l'utente sia l'autore o un admin del tenant).

3. Area Personale (User Specific)

Serve per mostrare all'utente la sua attività specifica all'interno del tenant.

    GET /me/bookmarks: Lista degli articoli salvati dall'utente corrente.

    GET /me/interactions: Ritorna un array di ID di articoli con cui l'utente ha interagito (per colorare i "cuoricini" nel frontend).

4. Pannello di Amministrazione (Backoffice)

Usate dal tuo staff o dai gestori del tenant per creare contenuti.

    POST /articles: Crea un nuovo articolo (gestisce anche la creazione della prima traduzione).

    PUT /articles/:id: Aggiorna i metadati globali.

    PUT /articles/:id/translations/:lang: Crea o aggiorna la traduzione in una lingua specifica.

    PATCH /articles/:id/status: Cambia stato (draft, published, archived).

5. Analytics e Sistema

   GET /stats/dashboard: Ritorna i dati aggregati della tabella DailyStats (visualizzazioni totali, nuovi commenti, etc.).

   GET /health: Controllo dello stato del servizio e della connessione al DB.

Struttura tipo di una richiesta (Esempio POST Like)

Il sito principale effettua la chiamata verso il microservizio in questo modo:

Header:

    x-api-key: tuo_hash_segreto (Identifica il Tenant)

    Content-Type: application/json

Body:
JSON

{
"externalUserId": "user_98765", // L'ID utente del tuo sito principale
"articleId": "uuid-articolo-123"
}

Un consiglio sulla gestione dello "Slug"

Dato che gestisci il multilingua, il GET /articles/:slug dovrebbe idealmente accettare un parametro lingua opzionale:
GET /articles/il-mio-post?lang=it

In questo modo il microservizio cerca nella tabella ArticleTranslation lo slug corrispondente a quella lingua e a quel tenant.

Ti sembra che manchi qualche funzionalità specifica, come ad esempio la gestione delle immagini (upload) o preferisci che quella rimanga sul sito principale?

2. Workflow di Moderazione (Logica API)

Ecco le API specifiche che il microservizio deve esporre al tuo sito principale per gestire il workflow:
A. Creazione Segnalazione (User Facing)

    POST /reports: Il sito principale invia la segnalazione.

        Payload: { targetType: "COMMENT", targetId: "abc", reason: "SPAM", reporterId: "user_123" }

        Logica: Il microservizio crea il report e, se necessario, incrementa un contatore interno o invia una notifica al tenant.

B. Gestione Reclami (Admin Facing)

    GET /reports?status=PENDING: Lista delle segnalazioni da gestire per il tenant.

    PATCH /reports/:id: Il moderatore cambia lo stato.

        Reviewed: Presa in carico.

        Dismissed: Segnalazione infondata (chiusura).

        Resolved: Azione intrapresa (es. commento eliminato).

3. Azioni Automatiche (The "Smart" Way)

Per rendere il sistema efficiente, puoi implementare delle "Soglie di Auto-Moderazione":

    Shadow Ban temporaneo: Se un contenuto riceve più di X segnalazioni PENDING, il microservizio può impostare automaticamente un flag isHidden (da aggiungere ai modelli Article o Comment) finché un moderatore non lo revisiona.

    Integrità Referenziale: Se un report viene risolto con l'eliminazione del contenuto, usa le transazioni Prisma per eliminare il Comment e segnare il Report come RESOLVED contemporaneamente.

4. Minimalismo e Privacy

Dato che vuoi tenere il minimo indispensabile:

    Non salvare i dati del reporter, solo il suo externalId.

    Le moderatorNote servono solo per scopi interni del tenant per capire perché una decisione è stata presa.

Estensione delle API esistenti

Dovrai aggiornare le API di lettura (GET /articles e GET /articles/:id/comments) per filtrare i contenuti che hanno uno stato di "oscurato" o "sotto revisione", a meno che la richiesta non provenga da un amministratore.

Pensi che la moderazione debba essere fatta manualmente per ogni segnalazione o ti serve una logica di "auto-oscuramento" al raggiungimento di un certo numero di report?
