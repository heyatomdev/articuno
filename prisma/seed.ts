/**
 * Seed locale per ambiente di sviluppo.
 *
 * Crea:
 *  - 1 Tenant "Demo" con API key in chiaro stampata a schermo
 *  - 4 Categorie
 *  - 3 Utenti
 *  - 6 Articoli (con traduzione IT) distribuiti nelle categorie
 *
 * Uso:  pnpm run db:seed
 */
import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaClient, ContentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter } as any);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  console.log('🌱  Avvio seed locale…\n');

  // ── 1. TENANT ────────────────────────────────────────────────────────────────
  const rawApiKey = `dev-${randomBytes(16).toString('hex')}`;
  const hashedKey = sha256(rawApiKey);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-tenant' },
    update: {},
    create: {
      slug: 'demo-tenant',
      name: 'Demo Tenant',
      description: 'Tenant di sviluppo locale',
      domain: 'demo.localhost',
      defaultLanguage: 'it',
      apiKey: hashedKey,
      enabled: true,
      webhookUrl: null,
      webhookSecret: null,
    },
  });

  console.log('✅  Tenant creato');
  console.log(`    ID      : ${tenant.id}`);
  console.log(`    Slug    : ${tenant.slug}`);
  console.log(`    API KEY : ${rawApiKey}   ← usa questo nell'header x-api-key\n`);

  // ── 2. CATEGORIE ─────────────────────────────────────────────────────────────
  const categoriesData = [
    { name: 'Tecnologia', slug: `tecnologia-${tenant.id.slice(0, 8)}`, description: 'Articoli tech & software', color: '#3B82F6' },
    { name: 'Business',   slug: `business-${tenant.id.slice(0, 8)}`,   description: 'Strategie e mercati',     color: '#10B981' },
    { name: 'Design',     slug: `design-${tenant.id.slice(0, 8)}`,     description: 'UI/UX e grafica',          color: '#F59E0B' },
    { name: 'Lifestyle',  slug: `lifestyle-${tenant.id.slice(0, 8)}`,  description: 'Benessere e cultura',      color: '#EC4899' },
  ];

  const categories = await Promise.all(
    categoriesData.map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: { ...cat, tenantId: tenant.id },
      }),
    ),
  );

  console.log(`✅  ${categories.length} categorie create`);
  categories.forEach((c) => console.log(`    • [${c.id}] ${c.name}`));
  console.log();

  // ── 3. UTENTI ─────────────────────────────────────────────────────────────────
  const usersData = [
    { externalId: 'user-alice', username: 'alice',   avatarUrl: 'https://i.pravatar.cc/150?u=alice'   },
    { externalId: 'user-bob',   username: 'bob',     avatarUrl: 'https://i.pravatar.cc/150?u=bob'     },
    { externalId: 'user-carol', username: 'carol',   avatarUrl: 'https://i.pravatar.cc/150?u=carol'   },
  ];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.upsert({
        where: { externalId_tenantId: { externalId: u.externalId, tenantId: tenant.id } },
        update: {},
        create: { ...u, tenantId: tenant.id, language: 'it' },
      }),
    ),
  );

  console.log(`✅  ${users.length} utenti creati`);
  users.forEach((u) => console.log(`    • [${u.id}] ${u.username} (externalId: ${u.externalId})`));
  console.log();

  // ── 4. ARTICOLI ──────────────────────────────────────────────────────────────
  const articlesData = [
    {
      categoryIndex: 0, authorIndex: 0, status: ContentStatus.PUBLISHED,
      translation: {
        title: 'Introduzione a NestJS',
        excerpt: 'Scopri come costruire API scalabili con NestJS e TypeScript.',
        content: '<p>NestJS è un framework progressivo per Node.js che sfrutta TypeScript per costruire applicazioni lato server efficienti e scalabili.</p>',
        slug: `introduzione-nestjs-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Introduzione a NestJS - Demo',
        metaDescription: 'Guida pratica a NestJS per sviluppatori TypeScript.',
      },
    },
    {
      categoryIndex: 0, authorIndex: 1, status: ContentStatus.PUBLISHED,
      translation: {
        title: 'Prisma ORM: guida rapida',
        excerpt: 'Come usare Prisma con PostgreSQL in un progetto Node.js.',
        content: '<p>Prisma è un ORM moderno che semplifica l\'accesso al database con type-safety completo.</p>',
        slug: `prisma-orm-guida-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Prisma ORM - Demo',
        metaDescription: 'Prisma con PostgreSQL: tutto quello che devi sapere.',
      },
    },
    {
      categoryIndex: 1, authorIndex: 0, status: ContentStatus.PUBLISHED,
      translation: {
        title: 'Come costruire un SaaS nel 2025',
        excerpt: 'Strategie e strumenti per lanciare un prodotto SaaS di successo.',
        content: '<p>Il mercato SaaS è in continua crescita. Ecco come posizionare il tuo prodotto e trovare i primi clienti.</p>',
        slug: `come-costruire-saas-2025-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Costruire SaaS 2025 - Demo',
        metaDescription: 'Guida al lancio di un SaaS nel 2025.',
      },
    },
    {
      categoryIndex: 1, authorIndex: 2, status: ContentStatus.DRAFT,
      translation: {
        title: 'Growth hacking per startup',
        excerpt: 'Tecniche di crescita rapida per startup early-stage.',
        content: '<p>Il growth hacking combina marketing, prodotto e dati per accelerare la crescita di una startup.</p>',
        slug: `growth-hacking-startup-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Growth Hacking - Demo',
        metaDescription: 'Growth hacking per startup: strategie pratiche.',
      },
    },
    {
      categoryIndex: 2, authorIndex: 1, status: ContentStatus.PUBLISHED,
      translation: {
        title: 'Principi di Design System',
        excerpt: 'Come creare e mantenere un design system efficace.',
        content: '<p>Un design system è una collezione di componenti riutilizzabili con regole chiare che guida team di prodotto nella coerenza.</p>',
        slug: `principi-design-system-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Design System - Demo',
        metaDescription: 'Tutto sui design system moderni.',
      },
    },
    {
      categoryIndex: 3, authorIndex: 2, status: ContentStatus.PUBLISHED,
      translation: {
        title: 'Produttività per sviluppatori',
        excerpt: 'Abitudini e tool per massimizzare la produttività da sviluppatore.',
        content: '<p>Dalla gestione del tempo agli strumenti CLI: scopri come lavorare meglio ogni giorno come developer.</p>',
        slug: `produttivita-sviluppatori-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Produttività Dev - Demo',
        metaDescription: 'Consigli pratici di produttività per sviluppatori.',
      },
    },
  ];

  let articleCount = 0;
  for (const data of articlesData) {
    const { translation, categoryIndex, authorIndex, status } = data;

    // Evita duplicati sullo slug della traduzione
    const existing = await prisma.articleTranslation.findFirst({
      where: { slug: translation.slug, tenantId: tenant.id },
    });
    if (existing) continue;

    await prisma.article.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[categoryIndex].id,
        authorId: users[authorIndex].id,
        status,
        featured: articleCount === 0,
        translations: {
          create: {
            ...translation,
            languageCode: 'it',
            tenantId: tenant.id,
          },
        },
      },
    });
    articleCount++;
  }

  console.log(`✅  ${articleCount} articoli creati\n`);

  // ── RIEPILOGO ─────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀  Ambiente locale pronto!');
  console.log();
  console.log('  Header da usare nelle richieste HTTP:');
  console.log(`    x-api-key: ${rawApiKey}`);
  console.log();
  console.log('  Esempio curl:');
  console.log(`    curl -H "x-api-key: ${rawApiKey}" http://localhost:3000/categories`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

