import { createServer, RequestListener, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  FileHarborService,
  FILEHARBOR_MAX_RESPONSE_BYTES,
  fileHarborFetch,
} from './fileharbor.service';

const config = { endpoint: 'https://cdn.example.com/v2', apiKey: 'k' };

describe('FileHarborService.isUnderEndpoint', () => {
  it.each([
    ['https://cdn.example.com/v2/images/0123456789abcdef', true],
    ['https://cdn.example.com/v2x/images/0123456789abcdef', false],
    ['https://evil.example.com/v2/images/0123456789abcdef', false],
    ['http://cdn.example.com/v2/images/0123456789abcdef', false],
    ['https://cdn.example.com.evil.io/v2/images/0123456789abcdef', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(FileHarborService.isUnderEndpoint(url, config.endpoint)).toBe(
      expected,
    );
  });
});

describe('FileHarborService', () => {
  const service = new FileHarborService();
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 204 }));
  });

  afterEach(() => fetchMock.mockRestore());

  const call = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url: String(url), init: init as RequestInit };
  };

  describe('deleteImageSafely', () => {
    it('refuses to delete a URL outside the tenant endpoint', async () => {
      await expect(
        service.deleteImageSafely(
          'https://attacker.example/images/0123456789abcdef',
          config,
        ),
      ).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('encodes the file id into the DELETE path, with the tenant key, no redirects', async () => {
      await service.deleteImageSafely(
        'https://cdn.example.com/v2/images/0123456789ab%2F..%2Fadmin',
        config,
      );
      const { url, init } = call();
      expect(url).toBe(
        'https://cdn.example.com/v2/images/0123456789ab%252F..%252Fadmin',
      );
      expect(init.method).toBe('DELETE');
      expect(init.redirect).toBe('manual');
      expect((init.headers as Record<string, string>)['X-API-Key']).toBe('k');
    });

    it('treats a 404 as already deleted', async () => {
      fetchMock.mockImplementation(
        async () =>
          new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }),
      );
      await expect(
        service.deleteImageSafely(
          'https://cdn.example.com/v2/images/0123456789abcdef',
          config,
        ),
      ).resolves.toBe(true);
    });
  });

  describe('uploadImageIfProvided', () => {
    const file = {
      buffer: Buffer.from('img'),
      originalname: 'a.png',
      mimetype: 'image/png',
      size: 3,
    } as Express.Multer.File;

    it('posts the file as the external user and returns the enveloped fullPath', async () => {
      fetchMock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: { fullPath: 'https://cdn/x.png' } }),
            { status: 201 },
          ),
      );
      await expect(
        service.uploadImageIfProvided(file, 'article', 'u1', config),
      ).resolves.toBe('https://cdn/x.png');

      const { url, init } = call();
      expect(url).toBe('https://cdn.example.com/v2/images');
      expect((init.headers as Record<string, string>)['X-User-Id']).toBe('u1');
      expect((init.body as FormData).get('description')).toBe('article Image');
    });

    it('fails when FileHarbor returns no URL', async () => {
      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify({ data: {} }), { status: 201 }),
      );
      await expect(
        service.uploadImageIfProvided(file, 'article', 'u1', config),
      ).rejects.toThrow(/no URL returned/);
    });
  });
});

describe('fileHarborFetch', () => {
  const listen = (handler: RequestListener) =>
    new Promise<Server>((resolve) => {
      const server = createServer(handler);
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
  const urlOf = (s: Server) =>
    `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

  let target: Server;
  let redirector: Server;
  let targetHits = 0;

  beforeAll(async () => {
    target = await listen((_req, res) => {
      targetHits++;
      res.end('x'.repeat(FILEHARBOR_MAX_RESPONSE_BYTES + 1));
    });
    redirector = await listen((_req, res) => {
      res.writeHead(307, { location: `${urlOf(target)}/internal` }).end();
    });
  });

  afterAll(() => {
    target.close();
    redirector.close();
  });

  it('does not follow redirects', async () => {
    const res = await fileHarborFetch(urlOf(redirector), { method: 'POST' });
    expect(res.status).toBe(307);
    expect(targetHits).toBe(0);
  });

  it('caps the response size', async () => {
    await expect(fileHarborFetch(urlOf(target))).rejects.toThrow(/bytes/);
  });
});
