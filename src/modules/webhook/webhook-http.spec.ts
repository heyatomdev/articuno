import { createServer, RequestListener, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { WEBHOOK_HTTP_OPTIONS } from './webhooks.module';
import { FILEHARBOR_HTTP_OPTIONS } from '@/modules/fileharbor/fileharbor.module';

const listen = (handler: RequestListener) =>
  new Promise<Server>((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
const urlOf = (s: Server) =>
  `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

describe.each([
  ['webhook', WEBHOOK_HTTP_OPTIONS],
  ['fileharbor', FILEHARBOR_HTTP_OPTIONS],
])('%s HTTP client', (_name, options) => {
  let http: HttpService;
  let target: Server;
  let redirector: Server;
  let targetHits = 0;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [HttpModule.register(options)],
    }).compile();
    http = mod.get(HttpService);
    target = await listen((_req, res) => {
      targetHits++;
      res.end('x'.repeat(2 * 1024 * 1024));
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
    await expect(
      lastValueFrom(http.post(urlOf(redirector), {})),
    ).rejects.toMatchObject({ response: { status: 307 } });
    expect(targetHits).toBe(0);
  });

  it('caps the response size', async () => {
    await expect(lastValueFrom(http.get(urlOf(target)))).rejects.toThrow(
      /maxContentLength/,
    );
  });

  it('has a timeout', () => {
    expect(http.axiosRef.defaults.timeout).toBeGreaterThan(0);
  });
});
