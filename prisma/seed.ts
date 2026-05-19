/**
 * Seed locale per ambiente di sviluppo.
 *
 * Crea:
 *  - 1 Tenant "Kaish DBD" con API key in chiaro stampata a schermo
 *  - 4 Categorie DBD
 *  - 7 Utenti (3 base + 4 aggiuntivi con status vari) + 1 Admin
 *  - 6 Articoli DBD (con traduzione IT) distribuiti nelle categorie
 *  - 4 Report (ARTICLE, COMMENT, USER con stati diversi)
 *  - 7 Daily Stats (ultimi 7 giorni con contatori realistici)
 *
 *  Uso:  pnpm run db:seed
 */
import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient, ContentStatus, UserRole, UserStatus, ReportStatus, TargetType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter } as any);

const DBD_COVER = 'https://fileharbor.heyatom.dev/v2/images/bf6dbd59-2f9c-4f67-8b82-6c0507f2ddfa';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  console.log('🌱  Avvio seed locale…\n');

  // ── 1. TENANT ────────────────────────────────────────────────────────────────
  const rawApiKey = `dev-${randomBytes(16).toString('hex')}`;
  const hashedKey = sha256(rawApiKey);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kaish-dbd' },
    update: {},
    create: {
      slug: 'kaish-dbd',
      name: 'Kaish DBD',
      description: 'Il portale italiano su Dead by Daylight: guide, killer, survivor e molto altro.',
      domain: 'kaishdbd.localhost',
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
    { name: 'Killer',    slug: `killer-${tenant.id.slice(0, 8)}`,    description: 'Guide e lore sui Killer di DBD',          color: '#DC2626' },
    { name: 'Survivor',  slug: `survivor-${tenant.id.slice(0, 8)}`,  description: 'Strategie e lore per i Survivor',         color: '#2563EB' },
    { name: 'Perks',     slug: `perks-${tenant.id.slice(0, 8)}`,     description: 'Analisi e tier list dei perk',             color: '#7C3AED' },
    { name: 'Guide',     slug: `guide-${tenant.id.slice(0, 8)}`,     description: 'Tutorial, build e consigli pratici',       color: '#059669' },
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
    { externalId: 'user-kaish',   username: 'Kaish',      avatarUrl: 'https://i.pravatar.cc/150?u=kaish'   },
    { externalId: 'user-wraith',  username: 'TheWraith',  avatarUrl: 'https://i.pravatar.cc/150?u=wraith'  },
    { externalId: 'user-nea',     username: 'Nea_Karlsson', avatarUrl: 'https://i.pravatar.cc/150?u=nea'   },
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

   // ── 3b. UTENTI AGGIUNTIVI CON STATUS DIVERSI ──────────────────────────────────
   const additionalUsersData = [
     { externalId: 'user-spammer',      username: 'SpammerBot',    avatarUrl: 'https://i.pravatar.cc/150?u=spammer', status: UserStatus.BANNED },
     { externalId: 'user-troll',        username: 'TrollKing',     avatarUrl: 'https://i.pravatar.cc/150?u=troll', status: UserStatus.SHADOW_BANNED },
     { externalId: 'user-contributor',  username: 'ItalianoMD',    avatarUrl: 'https://i.pravatar.cc/150?u=contributor', status: UserStatus.ACTIVE },
     { externalId: 'user-moderator',    username: 'ModerationAI',  avatarUrl: 'https://i.pravatar.cc/150?u=mod', status: UserStatus.ACTIVE },
   ];

   const additionalUsers = await Promise.all(
     additionalUsersData.map((u) =>
       prisma.user.upsert({
         where: { externalId_tenantId: { externalId: u.externalId, tenantId: tenant.id } },
         update: { status: u.status },
         create: { ...u, tenantId: tenant.id, language: 'it' },
       }),
     ),
   );

   console.log(`✅  ${additionalUsers.length} utenti aggiuntivi creati`);
   additionalUsers.forEach((u) => console.log(`    • [${u.id}] ${u.username} (status: ${u.status})`));
   console.log();

   // ── 3b. ADMIN USER ────────────────────────────────────────────────────────────
  const rawAdminPassword = `Admin@${randomBytes(6).toString('hex')}1!`;
  const hashedAdminPassword = await bcrypt.hash(rawAdminPassword, 12);
  const adminEmail = `admin@${tenant.slug}.dev`;

  const existingAdmin = await prisma.adminCredentials.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const adminUser = await prisma.user.upsert({
      where: { externalId_tenantId: { externalId: 'user-admin', tenantId: tenant.id } },
      update: {},
      create: {
        externalId: 'user-admin',
        username: 'admin',
        tenantId: tenant.id,
        language: 'it',
        role: UserRole.TENANT_ADMIN,
      },
    });

    await prisma.adminCredentials.create({
      data: {
        userId: adminUser.id,
        email: adminEmail,
        password: hashedAdminPassword,
      },
    });

    console.log('✅  Admin creato');
    console.log(`    Email    : ${adminEmail}`);
    console.log(`    Password : ${rawAdminPassword}   ← usa questa per il login admin`);
  } else {
    console.log('ℹ️   Admin già esistente, skip.');
    console.log(`    Email    : ${adminEmail}`);
  }
  console.log();

  // ── 4. ARTICOLI ──────────────────────────────────────────────────────────────
  const articlesData = [
    {
      categoryIndex: 0, authorIndex: 0, status: ContentStatus.PUBLISHED,
      coverImage: DBD_COVER,
      translation: {
        title: 'Guida completa al Trapper',
        excerpt: 'Il Trapper è il Killer simbolo di DBD: scopri la sua build ottimale e come padroneggiare le trappole.',
        content: '<p>Il Trapper è uno dei Killer più iconici di Dead by Daylight. La sua abilità speciale consiste nel posizionare trappole a orso sul terreno che catturano i Survivor di passaggio.</p><p>Per una build efficace si consigliano i perk <strong>Corrupt Intervention</strong>, <strong>Hex: Ruin</strong>, <strong>Nowhere to Hide</strong> e <strong>Deadlock</strong>.</p>',
        slug: `guida-trapper-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Guida Trapper DBD - Kaish DBD',
        metaDescription: 'Tutto sul Trapper di Dead by Daylight: build, strategie e addons.',
      },
    },
    {
      categoryIndex: 0, authorIndex: 1, status: ContentStatus.PUBLISHED,
      coverImage: DBD_COVER,
      translation: {
        title: 'Nurse: la Killer più difficile da masterare',
        excerpt: 'La Nurse rompe tutte le regole del gioco: una guida per chi vuole salire di livello.',
        content: '<p>La Nurse è considerata la Killer con il potenziale più alto in Dead by Daylight grazie alla sua abilità di teletrasportarsi attraverso i muri con il Blink.</p><p>Richiede centinaia di ore di pratica, ma una volta masterata è quasi imbattibile. Consigliamo di comenzar con addon che aumentano la velocità di recupero dal Blink.</p>',
        slug: `guida-nurse-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Guida Nurse DBD - Kaish DBD',
        metaDescription: 'Come giocare la Nurse in Dead by Daylight: consigli e build.',
      },
    },
    {
      categoryIndex: 1, authorIndex: 2, status: ContentStatus.PUBLISHED,
      coverImage: DBD_COVER,
      translation: {
        title: 'Dwight Fairfield: il Survivor per eccellenza',
        excerpt: 'Dwight è il Survivor più giocato e per una buona ragione: i suoi perk sono tra i migliori del gioco.',
        content: '<p>Dwight Fairfield è spesso il primo Survivor che i nuovi giocatori scelgono. I suoi perk esclusivi <strong>Bond</strong>, <strong>Prove Thyself</strong> e <strong>Leader</strong> lo rendono un ottimo supporto per il team.</p><p>Una build meta include Bond per tracciare i compagni, Prove Thyself per generatori veloci e Dead Hard per l\'escape.</p>',
        slug: `guida-dwight-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Guida Dwight DBD - Kaish DBD',
        metaDescription: 'Build e strategie per Dwight Fairfield in Dead by Daylight.',
      },
    },
    {
      categoryIndex: 1, authorIndex: 0, status: ContentStatus.DRAFT,
      coverImage: DBD_COVER,
      translation: {
        title: 'Meg Thomas: velocità e agilità',
        excerpt: 'Meg è la Survivor più agile del gioco: scopri come sfruttare al massimo le sue doti atletiche.',
        content: '<p>Meg Thomas è una dei Survivor più giocati grazie alla sua abilità innata <strong>Sprint Burst</strong> che le permette di scattare velocemente quando inizia a correre.</p><p>La sua build da loop prevede Sprint Burst, Dead Hard, Adrenaline e Off the Record per massimizzare le possibilità di sopravvivenza.</p>',
        slug: `guida-meg-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Guida Meg Thomas DBD - Kaish DBD',
        metaDescription: 'Come usare Meg Thomas in Dead by Daylight: build e strategie.',
      },
    },
    {
      categoryIndex: 2, authorIndex: 1, status: ContentStatus.PUBLISHED,
      coverImage: DBD_COVER,
      translation: {
        title: 'Tier List Perk Survivor 2026',
        excerpt: 'I migliori perk per Survivor nel meta attuale: guida aggiornata al capitolo più recente.',
        content: '<p><strong>S Tier:</strong> Dead Hard, Adrenaline, Decisive Strike, Off The Record</p><p><strong>A Tier:</strong> Borrowed Time, Unbreakable, Sprint Burst, Windows of Opportunity</p><p><strong>B Tier:</strong> Lithe, Iron Will, Kindred, We\'ll Make It</p><p>Il meta 2026 favorisce build autonome dopo il nerf a Decisive Strike del capitolo 32.</p>',
        slug: `tier-list-perk-survivor-2026-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Tier List Perk Survivor 2026 - Kaish DBD',
        metaDescription: 'I migliori perk survivor in DBD aggiornati al 2026.',
      },
    },
    {
      categoryIndex: 3, authorIndex: 2, status: ContentStatus.PUBLISHED,
      coverImage: DBD_COVER,
      translation: {
        title: 'Come migliorare al loop: guida per principianti',
        excerpt: 'Il loop è la meccanica core del gioco da Survivor. Ecco come sfruttare i punti forti della mappa.',
        content: '<p>Il <strong>loop</strong> consiste nel girare attorno a strutture della mappa per tenere il Killer impegnato il più a lungo possibile, guadagnando tempo prezioso per i compagni ai generatori.</p><p>I punti di loop migliori sono: <strong>Il Pallet</strong>, <strong>La Finestra</strong> e i loop lunghi tipo la struttura L. Impara a prevedere i movimenti del Killer e a usare i pallet in modo strategico, non panico.</p>',
        slug: `guida-loop-principianti-${tenant.id.slice(0, 8)}`,
        metaTitle: 'Guida al Loop DBD - Kaish DBD',
        metaDescription: 'Come fare loop in Dead by Daylight: guida per nuovi giocatori.',
      },
    },
  ];

  let articleCount = 0;
  for (const data of articlesData) {
    const { translation, categoryIndex, authorIndex, status, coverImage } = data;

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
        coverImage,
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

   // ── 5. REPORTS ────────────────────────────────────────────────────────────────
   // Recupera articoli e commenti per i report
   const articles = await prisma.article.findMany({
     where: { tenantId: tenant.id },
     take: 3,
   });

   const comments = await prisma.comment.findMany({
     where: { tenantId: tenant.id },
     take: 2,
   });

   const reportsData = [
     {
       reason: 'OFFENSIVE',
       description: 'Contenuto offensivo e discriminatorio',
       status: ReportStatus.PENDING,
       targetType: TargetType.ARTICLE,
       targetId: articles[0]?.id,
       reporterId: 'user-kaish',
     },
     {
       reason: 'SPAM',
       description: 'Commento contenente link spam',
       status: ReportStatus.REVIEWED,
       targetType: TargetType.COMMENT,
       targetId: comments[0]?.id,
       reporterId: 'user-wraith',
       moderatorId: 'user-moderator',
       moderatorNote: 'Spam confirmed, hidden',
     },
     {
       reason: 'INACCURATE',
       description: 'Informazioni non verificate e false',
       status: ReportStatus.RESOLVED,
       targetType: TargetType.ARTICLE,
       targetId: articles[1]?.id,
       reporterId: 'user-nea',
       moderatorId: 'user-moderator',
       moderatorNote: 'Content updated with correct information',
     },
     {
       reason: 'HARASSMENT',
       description: 'Utente molesto e aggressivo',
       status: ReportStatus.DISMISSED,
       targetType: TargetType.USER,
       targetId: additionalUsers[0]?.id, // SpammerBot
       reporterId: 'user-contributor',
       moderatorId: 'user-admin',
       moderatorNote: 'User already BANNED',
     },
   ];

   let reportCount = 0;
   for (const data of reportsData) {
     if (!data.targetId) continue;

     await prisma.report.upsert({
       where: {
         // Usa una combinazione unica per evitare duplicati
         id: `${data.targetType}-${data.targetId}-${data.reporterId}`.slice(0, 36),
       },
       update: {},
       create: {
         ...data,
         tenantId: tenant.id,
       },
     });
     reportCount++;
   }

   console.log(`✅  ${reportCount} report creati`);
   console.log(`    • 1 PENDING - Articolo offensivo`);
   console.log(`    • 1 REVIEWED - Commento spam`);
   console.log(`    • 1 RESOLVED - Articolo con info inesatte`);
   console.log(`    • 1 DISMISSED - Utente molesto\n`);

   // ── 6. DAILY STATS ────────────────────────────────────────────────────────────
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   const dailyStatsData = [];
   for (let i = 6; i >= 0; i--) {
     const date = new Date(today);
     date.setDate(date.getDate() - i);

     dailyStatsData.push({
       date,
       articlesPublished: Math.floor(Math.random() * 5) + 1, // 1-5 articoli al giorno
       totalViews: Math.floor(Math.random() * 500) + 100, // 100-600 visualizzazioni
       totalLikes: Math.floor(Math.random() * 150) + 20, // 20-170 like
       totalComments: Math.floor(Math.random() * 50) + 5, // 5-55 commenti
       totalBookmarks: Math.floor(Math.random() * 30) + 2, // 2-32 preferiti
     });
   }

   let statsCount = 0;
   for (const data of dailyStatsData) {
     await prisma.dailyStats.upsert({
       where: {
         date_tenantId: { date: data.date, tenantId: tenant.id },
       },
       update: {},
       create: {
         ...data,
         tenantId: tenant.id,
       },
     });
     statsCount++;
   }

   console.log(`✅  ${statsCount} statistiche giornaliere create (ultimi 7 giorni)\n`);

   // ── RIEPILOGO ─────────────────────────────────────────────────────────────────
   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
   console.log('🚀  Ambiente locale pronto! — Kaish DBD');
   console.log();
   console.log('📊 DATA CREATI:');
   console.log(`    • 1 Tenant con ${categories.length} categorie`);
   console.log(`    • ${users.length + additionalUsers.length + 1} Utenti (base + aggiuntivi con status vari + admin)`);
   console.log(`    • ${articleCount} Articoli (DBD content)`);
   console.log(`    • ${reportCount} Report (ARTICLE, COMMENT, USER - stati vari)`);
   console.log(`    • ${statsCount} Daily Stats (ultimi 7 giorni con contatori realistici)`);
   console.log();
   console.log('  Header da usare nelle richieste HTTP:');
   console.log(`    x-api-key: ${rawApiKey}`);
   console.log();
   console.log('  Login admin panel:');
   console.log(`    Email    : ${adminEmail}`);
   if (!existingAdmin) {
     console.log(`    Password : ${rawAdminPassword}`);
   } else {
     console.log('    Password : (già impostata in precedenza)');
   }
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

