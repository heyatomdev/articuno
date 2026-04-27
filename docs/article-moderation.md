# Flusso di Moderazione Articoli (Multi-tenant)

Questo documento descrive la gestione del ciclo di vita e della moderazione degli articoli. A differenza dei commenti, gli articoli sono considerati contenuti "ad alto impatto" e seguono un percorso di revisione più strutturato.

## 1. Stati dell'Articolo (`ContentStatus`)

L'articolo utilizza un set di stati più ampio per gestire sia la pubblicazione che la moderazione:

| Stato | Visibilità Pubblica | Descrizione |
| :--- | :--- | :--- |
| **DRAFT** | ❌ No | L'articolo è in fase di scrittura (visibile solo all'autore/admin). |
| **PUBLISHED** | ✅ Si | Articolo approvato e indicizzato. |
| **UNDER_REVIEW** | ✅ Si / ⚠️ Var. | Articolo segnalato. Rimane online ma con un "flag" interno per i moderatori. |
| **HIDDEN** | ❌ No | Articolo rimosso temporaneamente (es. sospetto copyright o dispute). |
| **BANNED** | ❌ No | Articolo rimosso permanentemente per violazione grave dei termini. |

---

## 2. Flusso di Creazione e Validazione

1.  **Drafting**: L'utente (autore) crea l'articolo tramite il sito principale.
2.  **Validazione Automatica**:
    - Il microservizio scansiona il `title` e il `content` per parole vietate (`BannedWords`).
    - Se vengono rilevate violazioni gravi, l'articolo può essere forzato in `HIDDEN` già al momento del salvataggio.
3.  **Pubblicazione**: Quando lo stato passa a `PUBLISHED`, il microservizio aggiorna i contatori del Tenant e lo rende disponibile nelle API pubbliche.

---

## 3. Gestione Segnalazioni Esterne

Gli articoli possono essere segnalati dagli utenti (es. per fake news, violazione copyright, incitamento all'odio):

1.  **Ricezione Segnalazione**: Viene creato un `Report` associato all'ID dell'articolo.
2.  **Soglia di Allerta**:
    - Essendo contenuti editoriali, la soglia per l'oscuramento automatico è più alta (es. 10+ segnalazioni).
    - Al raggiungimento della soglia, lo stato passa automaticamente a `UNDER_REVIEW`.
3.  **Notifica Webhook**:
    - Viene inviato un evento `article.flagged` al sito principale.
    - Il sito principale può decidere di mostrare un avviso: *"Questo contenuto è stato segnalato dalla community"*.

---

## 4. Workflow del Moderatore (Audit)

Il moderatore del Tenant ha tre opzioni principali nel gestire un articolo segnalato:

### A. Rigetto Segnalazioni (Keep)
- Il moderatore invalida i report.
- Lo stato torna/rimane `PUBLISHED`.
- L'articolo viene rimosso dalla coda di moderazione.

### B. Richiesta di Modifica (Soft Moderation)
- Il moderatore imposta l'articolo su `DRAFT` o `HIDDEN`.
- Invia una notifica all'autore (tramite il sito principale) chiedendo di correggere le parti problematiche.

### C. Ban Definitivo (Hard Moderation)
- Lo stato passa a `BANNED`.
- L'URL dell'articolo smette di rispondere (`404` o `410 Gone`).
- Eventuali ricavi o metriche associate vengono congelati.

---

## 5. Webhook e Sincronizzazione

Il microservizio garantisce che il sito principale sia sempre aggiornato:

```json
{
  "event": "article.status_changed",
  "tenantId": "uuid-tenant",
  "data": {
    "articleId": "uuid-articolo",
    "oldStatus": "PUBLISHED",
    "newStatus": "BANNED",
    "reason": "COPYRIGHT_INFRINGEMENT",
    "moderatorId": "staff_id_99"
  }
}
```
## 6. Sicurezza

- SEO: Quando un articolo viene rimosso (BANNED o HIDDEN), il microservizio consiglia al Tenant di gestire correttamente i redirect o i meta-tag per evitare penalizzazioni sui motori di ricerca.

- Relazioni: Se un articolo viene bannato, tutti i suoi Comments associati rimangono nel DB ma diventano inaccessibili poiché legati a un parent non visibile.
