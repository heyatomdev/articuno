import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Default banned words seeded for every new tenant.
 * The list covers common Italian profanity and offensive terms.
 * Feel free to extend it as needed.
 */
const DEFAULT_BANNED_WORDS: string[] = [
  // Insulti comuni italiani
  'cazzo',
  'vaffanculo',
  'fanculo',
  'stronzo',
  'stronza',
  'coglione',
  'cogliona',
  'minchia',
  'testa di cazzo',
  'figlio di puttana',
  'puttana',
  'troia',
  'bastardo',
  'bastarda',
  'idiota',
  'imbecille',
  'deficiente',
  'ritardato',
  'ritardata',
  'scemo',
  'scema',
  'porco',
  'porca',
  'merda',
  'cacca',
  'cazzone',
  'vaffanculo',
  'pezzo di merda',
  'merdoso',
  'lurido',
  'lurida',
  'sporca',
  'sporco',
  // Termini offensivi / discriminatori
  'negro',
  'negra',
  'frocio',
  'froccia',
  'ricchione',
  'culattone',
  'terrone',
  'polentone',
  'zingaro',
  'zingara',
  // Spam / phishing keywords (IT)
  'clicca qui',
  'guadagna subito',
  'soldi facili',
  'gratis ora',
  'offerta limitata',
  // English profanity & insults
  'fuck',
  'fucking',
  'fucker',
  'motherfucker',
  'shit',
  'bullshit',
  'asshole',
  'bitch',
  'bastard',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'faggot',
  'retard',
  'retarded',
  'moron',
  'idiot',
  'stupid',
  'dumbass',
  'jackass',
  'prick',
  'wanker',
  'twat',
  'damn',
  'ass',
  'nigger',
  'nigga',
  'cracker',
  'chink',
  'spic',
  'kike',
  // English spam / phishing keywords
  'click here',
  'earn money fast',
  'easy money',
  'free now',
  'limited offer',
  'buy now',
  'act now',
  'you have won',
  'claim your prize'
];

@Injectable()
export class BannedWordsSeedService {
  private readonly logger = new Logger(BannedWordsSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seeds the default banned-words list for a newly created tenant.
   * Uses createMany with skipDuplicates so it is idempotent.
   *
   * @param tenantId - The ID of the tenant to seed banned words for
   */
  async seedDefaultBannedWords(tenantId: string): Promise<void> {
    const words = DEFAULT_BANNED_WORDS.map((w) => ({
      word: w.toLowerCase().trim(),
      tenantId,
    }));

    const result = await this.prisma.bannedWord.createMany({
      data: words,
      skipDuplicates: true,
    });

    this.logger.log(
      `🚫 Seeded ${result.count} default banned words for tenant ${tenantId}.`,
    );
  }
}

