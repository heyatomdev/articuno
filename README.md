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

Il microservizio invia eventi (es. comment.created, article.flagged) all'URL configurato dal Tenant. Ogni richiesta è firmata con un segreto condiviso nell'header x-webhook-signature.

Vedi la Guida Validazione Webhook per i dettagli tecnici.

## ⚙️ Installazione

1. **Clona il repository**:
   ```bash
   git clone [https://github.com/tuo-username/cms-microservice.git](https://github.com/tuo-username/cms-microservice.git)
   cd cms-microservice

    Installa le dipendenze:
    Bash

    npm install

    Configura le variabili d'ambiente:
    Crea un file .env nella root del progetto:
    Snippet di codice

    DATABASE_URL="postgresql://user:password@localhost:5432/cms_db?schema=public"
    PORT=3000

    Inizializza il database:
    Bash

    npx prisma generate
    npx prisma db push

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

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
