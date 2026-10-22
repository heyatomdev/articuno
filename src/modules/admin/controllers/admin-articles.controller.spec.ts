import { ContentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  articlePayload,
  canSetArticleAuthor,
  canSetArticleStatus,
} from './admin-articles.controller';

const { DRAFT, PUBLISHED, UNDER_REVIEW, HIDDEN, BANNED } = ContentStatus;

describe('canSetArticleStatus', () => {
  it('lets an AUTHOR publish and unpublish', () => {
    expect(canSetArticleStatus('AUTHOR', PUBLISHED, DRAFT)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', DRAFT, PUBLISHED)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', PUBLISHED)).toBe(true);
  });

  it('keeps an AUTHOR from setting a moderation status', () => {
    expect(canSetArticleStatus('AUTHOR', HIDDEN, PUBLISHED)).toBe(false);
    expect(canSetArticleStatus('AUTHOR', UNDER_REVIEW)).toBe(false);
  });

  it('keeps an AUTHOR from moving an article out of moderation', () => {
    expect(canSetArticleStatus('AUTHOR', PUBLISHED, UNDER_REVIEW)).toBe(false);
    expect(canSetArticleStatus('AUTHOR', DRAFT, HIDDEN)).toBe(false);
  });

  it('allows no-op status and edits without status', () => {
    expect(canSetArticleStatus('AUTHOR', HIDDEN, HIDDEN)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', undefined, BANNED)).toBe(true);
  });

  it('lets a MODERATOR do all of it', () => {
    expect(canSetArticleStatus('MODERATOR', PUBLISHED, HIDDEN)).toBe(true);
    expect(canSetArticleStatus('MODERATOR', BANNED, PUBLISHED)).toBe(true);
  });
});

describe('articlePayload', () => {
  const MP = 'multipart/form-data; boundary=x';

  it('reads a JSON body whole, never its `data` field', () => {
    expect(articlePayload('application/json', { status: 'DRAFT' })).toBe(
      '{"status":"DRAFT"}',
    );
    // a `data` string stays a field, which the DTO whitelist then rejects
    expect(
      JSON.parse(
        articlePayload('application/json', { data: '{"status":"BANNED"}' }),
      ),
    ).toEqual({ data: '{"status":"BANNED"}' });
  });

  it('reads a multipart body from `data` only', () => {
    expect(articlePayload(MP, { data: '{"status":"DRAFT"}' })).toBe(
      '{"status":"DRAFT"}',
    );
  });

  it('refuses multipart fields other than `data`', () => {
    expect(() => articlePayload(MP, { status: 'BANNED' })).toThrow(
      BadRequestException,
    );
    expect(() => articlePayload(MP, { data: '{}', status: 'BANNED' })).toThrow(
      BadRequestException,
    );
    expect(() => articlePayload(MP, { data: ['{}', '{}'] })).toThrow(
      BadRequestException,
    );
  });
});

describe('canSetArticleAuthor', () => {
  it('is a moderator call', () => {
    expect(canSetArticleAuthor('AUTHOR')).toBe(false);
    expect(canSetArticleAuthor('MODERATOR')).toBe(true);
    expect(canSetArticleAuthor('SUPER_ADMIN')).toBe(true);
  });
});
