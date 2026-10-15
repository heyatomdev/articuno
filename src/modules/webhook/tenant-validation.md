# Guida alla Validazione dei Webhook per i Tenant

Articuno invia gli eventi (moderazione, cambi di stato degli articoli) al tuo `webhookUrl` con richieste `POST` firmate in formato [Standard Webhooks](https://www.standardwebhooks.com/). Contratto completo ed elenco eventi: [guida di integrazione §8](../../../../docs/integrations/articuno.md).

## Header

| Header | Contenuto |
|---|---|
| `webhook-id` | ID dell'evento: identico nei retry e nei re-invii, usalo per deduplicare |
| `webhook-timestamp` | Unix seconds dell'invio |
| `webhook-signature` | `v1,<base64 HMAC-SHA256>` (più firme separate da spazio, accettane una qualsiasi) |

## Verifica

1. Rifiuta se `webhook-timestamp` dista più di 5 minuti dal tuo orologio.
2. Calcola HMAC-SHA256 di `<webhook-id>.<webhook-timestamp>.<body grezzo>` con il `webhookSecret` (stringa UTF-8) e codificalo in base64.
3. Confrontalo in tempo costante con le firme di `webhook-signature`.
4. Se hai già processato quel `webhook-id`, rispondi 2xx e non fare nulla.

```javascript
const crypto = require('crypto');

// rawBody: i byte esatti ricevuti, non JSON.stringify(req.body)
function verifyWebhook(headers, rawBody, secret) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(`${id}.${ts}.${rawBody}`).digest('base64'),
  );
  return (headers['webhook-signature'] || '').split(' ').some((sig) => {
    const got = Buffer.from(sig.replace(/^v1,/, ''));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}
```

Rispondi 2xx subito e lavora in background: oltre 5 s di attesa la consegna è un fallimento e viene ritentata.
