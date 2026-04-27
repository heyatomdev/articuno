# Flusso di Moderazione Commenti (Multi-tenant)

Questo documento descrive l'architettura e il flusso logico della moderazione dei commenti all'interno del microservizio. Il sistema è progettato per essere autonomo, resiliente e per minimizzare il carico di lavoro manuale dei moderatori.

## 1. Architettura degli Stati

Ogni commento nel database può assumere uno dei seguenti stati (`ContentStatus`):

| Stato       | Visibilità Pubblica | Descrizione                                                        |
|:------------|:--------------------|:-------------------------------------------------------------------|
| **VISIBLE** | ✅ Si                | Commento approvato e visibile a tutti.                             |
| **HIDDEN**  | ❌ No                | Nascondo il commento per violazione termini o troppe segnalazioni. |
| **BANNED**  | ❌ No                | Eliminazione logica permanente (non recuperabile).                 |

In parallelo, l'utente ha uno stato (`UserStatus`):
- **ACTIVE**: Operatività normale.
- **SHADOW_BANNED**: L'utente può scrivere, ma i suoi commenti nascono automaticamente come `HIDDEN`.
- **BANNED**: L'utente riceve un errore 403 ad ogni tentativo di interazione.

---

## 2. Flusso di Inserimento Commento

Quando il sito principale (Tenant) invia un commento via API:

1.  **Check Stato Utente**:
    - Se l'utente è `BANNED` sul tenant attuale -> **Rifiuta (403)**.
    - Se l'utente è `SHADOW_BANNED` -> Imposta stato commento = `HIDDEN`.
2.  **Analisi Contenuto (Banned Words)**:
    - Il microservizio scansiona il testo cercando parole nella tabella `BannedWords` del tenant.
    - Se trovate -> Imposta stato commento = `HIDDEN` e crea un `Report` automatico di sistema.
3.  **Persistenza**:
    - Il commento viene salvato.
4.  **Notifica Webhook**:
    - Se il commento è stato auto-moderato (`HIDDEN`), il microservizio invia un Webhook al Tenant per avvisare l'interfaccia utente.

---

## 3. Flusso di Segnalazione (Crowdsourced)

Il sistema permette agli utenti di segnalare contenuti inappropriati:

1.  **Ricezione Segnalazione**: Viene creata una entry nella tabella `Report`.
2.  **Incremento Counter**: Il campo `reportCount` sul commento viene incrementato.
3.  **Soglia di Auto-Oscuramento**:
    - Se `reportCount` >= **X** (es. 5 segnalazioni):
        - Il commento passa da `VISIBLE` a `HIDDEN`.
        - Viene inviato un Webhook di tipo `comment.hidden` al Tenant.
        - Il Tenant può così notificare i moderatori o inviare una mail.

---

## 4. Revisione Umana e Risoluzione

Il moderatore del Tenant interagisce con il microservizio tramite il pannello di controllo:

### Caso A: Contenuto Accettabile (Falso Positivo)
- Il moderatore "approva" il report.
- Il microservizio resetta `reportCount = 0` e imposta `status = VISIBLE`.
- Il commento torna visibile sul sito.

### Caso B: Violazione Confermata
- Il moderatore "conferma" il ban.
- Il microservizio imposta `status = BANNED`.
- Se l'utente è un recidivo, il moderatore può scegliere di fare l'upgrade a `SHADOW_BANNED` o `BANNED` per l'intero profilo utente.

---

## 5. Shadow Ban: La Strategia Silenziosa

Per combattere spammer e troll senza innescare ritorsioni (come la creazione immediata di nuovi account), lo **Shadow Ban** funziona così:

1. L'utente invia un commento.
2. Il server risponde con `201 Created`.
3. Il commento viene salvato come `HIDDEN`.
4. Nelle query pubbliche (`GET /comments`), il commento non appare.
5. Nelle query private dell'utente (es. `GET /me/comments`), il commento appare come se fosse tutto normale.

---

## 6. Integrazione Webhook (Esempio Payload)

Quando un commento cambia stato per motivi di moderazione, il microservizio invia:

```json
{
  "event": "comment.moderated",
  "tenantId": "uuid-tenant",
  "data": {
    "commentId": "uuid-commento",
    "externalAuthorId": "user_123",
    "newStatus": "HIDDEN",
    "reason": "REPORT_THRESHOLD_REACHED"
  }
}
```
