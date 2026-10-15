<p align="center">
  <a href="https://github.com/heyatomdev/articuno" target="blank"><img src="app_logo.png" width="900" alt="Articuno App Logo" /></a>
</p>

<p align="center">
Multi-tenant CMS management system built with NestJS, Prisma ORM, and PostgreSQL.
</p>

Un microservizio robusto e scalabile basato su **NestJS** per la gestione di articoli, commenti e interazioni sociali in un ambiente multi-tenant. Il sistema è progettato per operare "dietro le quinte" rispetto a siti principali (Tenant), comunicando tramite API sicure e Webhook.

## 🚀 Caratteristiche Principali

- **Architettura Multi-Tenant**: Isolamento totale dei dati tra diversi tenant tramite `tenantId`.
- **Sicurezza Avanzata**: Autenticazione basata su API Key con hashing (SHA-256) lato database.
- **Gestione Contenuti Multilingua**: Supporto nativo per traduzioni di articoli e categorie.
- **Sistema di Moderazione Intelligente**:
    - Filtro automatico basato su parole vietate (Banned Words).
    - Gestione segnalazioni (Reports) con soglie di auto-oscuramento.
    - Supporto per lo **Shadow Ban** degli utenti molesti.
- **Integrazione Webhook**: Sistema di notifiche "Outbox" resiliente con firma HMAC per la sicurezza dei client.
- **Statistiche Giornaliere**: Aggregazione automatica dei dati di utilizzo per tenant.

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL (consigliato)
- **Validazione**: Class-validator & Class-transformer
- **Comunicazione**: Axios (HttpModule) per Webhook & @nestjs/schedule per i Cron Jobs

## 📋 Requisiti

- Node.js (v18 o superiore)
- Un'istanza di database compatibile con Prisma (PostgreSQL, MySQL, etc.)
- 

### 🔐 Sicurezza (API Keys)

Il microservizio non salva mai le API Key in chiaro. Quando viene creato un Tenant:

    Viene generata una chiave casuale.

    Viene salvato l'hash SHA-256 nel database.

    Il client deve inviare la chiave originale nell'header x-api-key. Il middleware calcola l'hash al volo per validare la richiesta.

📡 Integrazione Webhook

Il microservizio invia eventi (es. comment.created, article.flagged) all'URL configurato dal Tenant. Ogni richiesta è firmata col segreto condiviso in formato Standard Webhooks (header `webhook-id`, `webhook-timestamp`, `webhook-signature`).

Vedi la Guida Validazione Webhook per i dettagli tecnici.

## ⚙️ Installazione

```bash
pnpm install
cp .env.example .env              # DATABASE_URL, BASTION_URL, …
pnpm run prisma:generate
pnpm exec prisma migrate deploy   # non `db push`: salterebbe gli indici scritti a mano nelle migration
pnpm run start:dev
```

Swagger (`/docs`) è attivo solo con `NODE_ENV=development|test` o `ENABLE_SWAGGER=true`.
CORS: senza `CORS_ORIGINS` nessuna origin browser è ammessa, anche in sviluppo.

## Run tests

```bash
pnpm run test
pnpm run test:cov
```

## Deployment

**Le migration non girano nell'immagine.** Il `Dockerfile` non esegue `prisma migrate deploy`,
e non potrebbe: `prisma` è una devDependency e `pnpm prune --prod` rimuove la CLI. Il container
parte (`node dist/main.js`) sullo schema che trova.

Prima di avviare una nuova versione, applicare le migration da un checkout dello stesso commit
(o da CI) contro il database di destinazione:

```bash
DATABASE_URL=postgresql://… pnpm exec prisma migrate deploy
```

Alcune migration contengono SQL scritto a mano che Prisma non sa esprimere (indice parziale
`webhook_events_due_idx`, unique parziale `reports_open_reporter_target_key`): `prisma db push`
non li crea, usare sempre `migrate deploy`.

> Nessun repository della piattaforma esegue oggi `migrate deploy` per articuno (né compose
> né pipeline): dove giri in produzione va verificato con chi gestisce il deploy.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
