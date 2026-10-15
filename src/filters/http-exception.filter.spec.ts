import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  const hostFor = (url: string) =>
    ({
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url }),
      }),
    }) as any;
  const host = hostFor('/users/ext-1');
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

  it.each([
    ['/health', new ServiceUnavailableException(), 503],
    ['/config/app.yml', new NotFoundException(), 404],
    ['/favicon.ico', new NotFoundException(), 404],
    ['/manifest.json', new NotFoundException(), 404],
    ['/foo/bar.json?x=1', new NotFoundException(), 404],
  ])(
    'still answers a quiet path (%s) instead of leaving it hanging',
    (url, exception, status) => {
      const error = jest.spyOn(Logger.prototype, 'error');
      filter.catch(exception, hostFor(url));
      expect(res.status).toHaveBeenCalledWith(status);
      expect(json).toHaveBeenCalledTimes(1);
      expect(json.mock.calls[0][0]).toMatchObject({
        statusCode: status,
        path: url,
      });
      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    },
  );
});
