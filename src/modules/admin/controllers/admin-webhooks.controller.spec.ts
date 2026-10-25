import { isPaginated, paginate } from '@heyatom/nest-common';
import { AdminWebhooksController } from './admin-webhooks.controller';
import { DEAD_LETTER_DATE } from '@/modules/webhook/webhook.constants';

describe('AdminWebhooksController', () => {
  it('findAll keeps the page marker, so TransformInterceptor does not wrap it twice', async () => {
    const row = { id: 'e1', sentAt: null, nextRetryAt: DEAD_LETTER_DATE };
    const service = {
      findAll: jest
        .fn()
        .mockResolvedValue(paginate([row], 1, { page: 1, limit: 20 })),
    };
    const controller = new AdminWebhooksController(service as any);

    const page = await controller.findAll({ tenantId: 't1' } as any, {} as any);

    expect(isPaginated(page)).toBe(true);
    expect(page.data).toEqual([
      { ...row, nextRetryAt: null, deadLettered: true },
    ]);
    expect(page.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });
});
