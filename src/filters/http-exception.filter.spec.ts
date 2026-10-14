import { Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: '/users/ext-1' }),
    }),
  } as any;
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('boom', {
      code,
      clientVersion: 'test',
    });

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => jest.clearAllMocks());

  it('maps a foreign-key violation (P2003) to 409', () => {
    filter.catch(prismaError('P2003'), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
  });

  it('keeps other Prisma errors a 500 without leaking the message', () => {
    filter.catch(prismaError('P2010'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].message).not.toContain('boom');
  });

  it('passes HTTP exceptions through', () => {
    filter.catch(new NotFoundException('Utente non trovato'), host);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
