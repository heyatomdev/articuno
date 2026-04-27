# Guida alla Validazione dei Webhook per i Tenant

Il nostro sistema invia notifiche in tempo reale (come nuovi commenti, like o azioni di moderazione) verso il tuo URL configurato tramite richieste `POST`. Per garantire che la richiesta provenga effettivamente dal nostro microservizio e che il contenuto non sia stato manomesso, **devi validare la firma** inclusa in ogni chiamata.

## 1. Parametri di Sicurezza

- **URL Webhook**: L'endpoint sul tuo server che riceverà le notifiche (es. `https://tuosito.com/api/webhooks`).
- **Webhook Secret**: Una stringa segreta condivisa tra il nostro microservizio e il tuo server. **Non condividerla mai**.
- **Header della richiesta**: Ogni chiamata conterrà l'header `x-webhook-signature`.

## 2. Logica di Validazione

La firma è un hash **HMAC SHA-256** generato utilizzando il tuo `Webhook Secret` e l'intero `body` della richiesta (formato JSON).

### Passaggi per la verifica:
1. Ricevi la richiesta `POST`.
2. Leggi il corpo (`body`) della richiesta come stringa grezza.
3. Leggi il valore dell'header `x-webhook-signature`.
4. Calcola l'hash HMAC SHA-256 del body usando il tuo segreto.
5. Confronta il tuo hash calcolato con quello ricevuto nell'header.

---

## 3. Esempi di Implementazione

### Node.js (Express)
```javascript
const crypto = require('crypto');

function verifyWebhook(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.YOUR_WEBHOOK_SECRET;
  
  // Importante: usa il body grezzo (raw) se il tuo parser lo modifica
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature === digest) {
    return next(); // Firma valida
  } else {
    return res.status(401).send('Firma Webhook non valida');
  }
}

app.post('/webhooks/notifications', verifyWebhook, (req, res) => {
  console.log('Evento ricevuto:', req.body.event);
  res.status(200).send('OK');
});
```

### 4. Struttura del Payload

Riceverai sempre un oggetto JSON con questo formato:
```json
{
  "event": "comment.created",
  "timestamp": "2023-10-27T10:00:00Z",
  "data": {
    "id": "uuid-notifica",
    "type": "COMMENT",
    "message": "Qualcuno ha commentato il tuo articolo",
    "userId": "external-user-id",
    "tenantId": "tuo-tenant-id"
  }
}
```

### 5. Note aggiuntive

- Rispondi velocemente: Restituisci un codice 200 OK immediatamente dopo aver ricevuto la notifica. Elabora la logica pesantemente in background (code/job) per non causare timeout sul nostro server.

- Idempotenza: Gestisci la possibilità di ricevere lo stesso evento più di una volta (usa l'ID della notifica per controllare se l'hai già processata).

