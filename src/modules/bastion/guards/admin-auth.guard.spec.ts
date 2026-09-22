import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuthGuard } from './admin-auth.guard';
import { BastionUserGuard } from './bastion-user.guard';
import { SessionGuard } from '@/modules/auth/guards/session.guard';

const mockBastion = { canActivate: jest.fn().mockResolvedValue(true) };
const mockSession = { canActivate: jest.fn().mockResolvedValue(true) };

function makeCtx(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminAuthGuard,
        { provide: BastionUserGuard, useValue: mockBastion },
        { provide: SessionGuard, useValue: mockSession },
      ],
    }).compile();

    guard = module.get(AdminAuthGuard);
    jest.clearAllMocks();
  });

  it('delegates to the Bastion guard when a Bearer token is present', async () => {
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).resolves.toBe(true);
    expect(mockBastion.canActivate).toHaveBeenCalledTimes(1);
    expect(mockSession.canActivate).not.toHaveBeenCalled();
  });

  it('falls back to the legacy cookie guard when there is no Bearer token', async () => {
    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);
    expect(mockSession.canActivate).toHaveBeenCalledTimes(1);
    expect(mockBastion.canActivate).not.toHaveBeenCalled();
  });

  // A non-Bearer Authorization header must not silently skip auth: it goes down the
  // cookie branch, which rejects it when the cookie is absent.
  it('falls back to the cookie guard for a non-Bearer Authorization header', async () => {
    await guard.canActivate(makeCtx({ authorization: 'Basic abc' }));
    expect(mockSession.canActivate).toHaveBeenCalledTimes(1);
    expect(mockBastion.canActivate).not.toHaveBeenCalled();
  });

  it('propagates the rejection of the branch it picked', async () => {
    mockBastion.canActivate.mockRejectedValueOnce(new Error('nope'));
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow('nope');
  });

  // The security property of this guard. A Bearer that fails must NOT get a second
  // chance at the cookie: falling back on failure would turn the transition window
  // into a bypass, where presenting a junk token reverts you to the legacy path.
  it('does not fall back to the cookie when the Bearer branch rejects', async () => {
    mockBastion.canActivate.mockRejectedValueOnce(new Error('expired'));

    await expect(
      guard.canActivate(
        makeCtx({ authorization: 'Bearer expired', cookie: 'sessionId=valid' }),
      ),
    ).rejects.toThrow('expired');
    expect(mockSession.canActivate).not.toHaveBeenCalled();
  });
});
