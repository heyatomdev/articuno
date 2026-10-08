import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { stripTags, stripTranslationText } from './html-sanitizer';
import { slugifySafe } from './slugify';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';

describe('stripTags / stripTranslationText', () => {
  it('keeps the text, drops the markup', () => {
    expect(stripTags('<img src=x onerror=alert(1)>Ciao <b>mondo</b>')).toBe(
      'Ciao mondo',
    );
  });

  it('stores plain text, not HTML entities', () => {
    expect(stripTags('Tom & Jerry <b>"quoted"</b> 5 > 3')).toBe(
      'Tom & Jerry "quoted" 5 > 3',
    );
  });

  it('slugifies the decoded title (no "amp" in the slug)', () => {
    const { title } = stripTranslationText({ title: 'Tom &amp; <i>Jerry</i>' });
    expect(title).toBe('Tom & Jerry');
    expect(slugifySafe(title)).toMatch(/^tom-jerry-[0-9a-z]{8}$/);
  });

  it('strips title and SEO fields, leaves the rest alone', () => {
    const out = stripTranslationText({
      title: '<script>x</script>Titolo',
      metaTitle: '<i>Meta</i>',
      content: '<p>body</p>',
    });
    expect(out).toEqual({
      title: 'Titolo',
      metaTitle: 'Meta',
      content: '<p>body</p>',
    });
  });
});

describe('article DTO limits', () => {
  const errorsOf = (cls: any, plain: object) =>
    validateSync(plainToInstance(cls, plain) as object).map((e) => e.property);
  const translation = {
    languageCode: 'en-US',
    title: 'Hello',
    content: 'x',
    excerpt: 'x',
  };

  it('accepts a BCP 47 code and rejects anything else', () => {
    expect(errorsOf(CreateArticleTranslationDto, translation)).toEqual([]);
    expect(
      errorsOf(CreateArticleTranslationDto, {
        ...translation,
        languageCode: '../en',
      }),
    ).toContain('languageCode');
  });

  it('caps the title length', () => {
    expect(
      errorsOf(CreateArticleTranslationDto, {
        ...translation,
        title: 'x'.repeat(201),
      }),
    ).toContain('title');
  });

  it('only takes an https coverImage', () => {
    const base = { categoryId: '123e4567-e89b-12d3-a456-426614174000' };
    expect(
      errorsOf(CreateArticleDto, {
        ...base,
        coverImage: 'javascript:alert(1)',
      }),
    ).toContain('coverImage');
    expect(
      errorsOf(CreateArticleDto, {
        ...base,
        coverImage: 'https://cdn.example.com/v2/images/abc',
      }),
    ).toEqual([]);
    expect(
      errorsOf(CreateArticleDto, {
        ...base,
        coverImage: 'https://fileharbor:3000/v2/images/abc',
      }),
    ).toEqual([]);
  });
});
