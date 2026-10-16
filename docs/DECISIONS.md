---
type: decision
service: articuno
status: done
updated: 2026-10-16
verified: fe0bae7
---

# Decisions — Articuno

Scelte del servizio e deviazioni dallo standard HTTP di piattaforma
([`docs/standards/api.md`](../../docs/standards/api.md)), come richiede il §0.8.

## D-001 · API pubblica senza throttler — TAKEN

**Date**: 2026-10-16 · **Reference**: [api.md §8 Rate limiting](../../docs/standards/api.md)

### The problem
Lo standard vuole `@nestjs/throttler` globale su ogni servizio con superficie HTTP. L'API
pubblica di Articuno (`/articles`, `/tags`, `/comments`, `/interactions`…, autenticata con
`X-API-Key` del tenant via `TenantMiddleware`) è chiamata solo dai backend dei tenant,
server-to-server. In Docker tutti i backend raggiungono Articuno dallo stesso IP: un throttler
per `req.ip` metterebbe tutti i tenant, e tutti i loro utenti finali, in un unico bucket.

### The decision
Il throttler copre solo le rotte `/admin/*`: `AdminThrottlerGuard`
(`src/guards/admin-throttler.guard.ts`) applicato con `@UseGuards` sui controller admin,
`THROTTLE_LIMIT` richieste per `THROTTLE_TTL_SECONDS`, bucket per `sub` dell'utente Bastion
(fallback IP). Il `ThrottlerModule` in `app.module.ts` non registra nessun guard globale,
quindi l'API pubblica non è limitata. Il rate limit degli utenti finali spetta al sito del
tenant, che conosce l'IP e l'identità del visitatore.

### On what data
Unico chiamante dell'API pubblica: i backend dei tenant (es. dbdbuilds-api), nessun client
browser. L'IP di rete visto da Articuno è lo stesso per tutti i tenant; l'identità reale del
chiamante è l'`X-API-Key`.

### What would change it
- Un tenant che abusa dell'API o un tenant non fidato: throttler per tenant, con tracker
  sull'hash dell'`X-API-Key` (o sul `tenantId` risolto dal middleware) invece che sull'IP.
- Un client esposto direttamente al browser senza backend del tenant davanti.
