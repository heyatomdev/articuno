import { of } from 'rxjs';
import { FileHarborService } from './fileharbor.service';

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

describe('FileHarborService.deleteImageSafely', () => {
  const http = { delete: jest.fn() };
  const service = new FileHarborService(http as any);

  beforeEach(() => {
    jest.resetAllMocks();
    http.delete.mockReturnValue(of({ data: {} }));
  });

  it('refuses to delete a URL outside the tenant endpoint', async () => {
    await expect(
      service.deleteImageSafely(
        'https://attacker.example/images/0123456789abcdef',
        config,
      ),
    ).resolves.toBe(false);
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('encodes the file id into the DELETE path', async () => {
    await service.deleteImageSafely(
      'https://cdn.example.com/v2/images/0123456789ab%2F..%2Fadmin',
      config,
    );
    expect(http.delete.mock.calls[0][0]).toBe(
      'https://cdn.example.com/v2/images/0123456789ab%252F..%252Fadmin',
    );
  });
});
