import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';

/**
 * Unit tests for the mobile-OTP sign-up/sign-in flow.
 *
 * Prisma, WhatsApp and the JWT signer are stubbed — these cover the decisions
 * AuthService makes (normalization, role assignment, expiry/attempt/cooldown
 * rules, rollback on delivery failure), not the database.
 */

const ACTIVE_USER = {
  id: 'u1',
  firstName: 'Rita',
  lastName: 'Sharma',
  name: 'Rita Sharma',
  email: null,
  mobileNo: '+919876543210',
  city: null,
  state: null,
  role: 'RESELLER' as const,
  isActive: true,
  passwordHash: null,
  isEmailVerified: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

function build(overrides: {
  user?: unknown;
  otp?: unknown;
  sendOtp?: jest.Mock;
} = {}) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(overrides.user ?? null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ ...ACTIVE_USER, ...data, id: 'new' })),
      update: jest.fn().mockResolvedValue(ACTIVE_USER),
    },
    mobileOtp: {
      findUnique: jest.fn().mockResolvedValue(overrides.otp ?? null),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'sess1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const whatsapp = { sendOtp: overrides.sendOtp ?? jest.fn().mockResolvedValue({ accepted: true }) };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = {
    get: (key: string, fallback?: string) =>
      ({ JWT_REFRESH_SECRET: 'secret', WHATSAPP_DEFAULT_COUNTRY_CODE: '91' })[key] ?? fallback,
  };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    { send: jest.fn() } as never,
    whatsapp as never,
    { log: jest.fn() } as never,
  );
  return { service, prisma, whatsapp, jwt };
}

/** A live, unexpired OTP record whose code is "123456". */
function liveOtp(over: Partial<Record<string, unknown>> = {}) {
  const { createHash } = require('node:crypto');
  return {
    id: 'otp1',
    mobileNo: '+919876543210',
    codeHash: createHash('sha256').update('123456').digest('hex'),
    expiresAt: new Date(Date.now() + 600_000),
    attempts: 0,
    lastSentAt: new Date(Date.now() - 120_000), // past the 60s cooldown
    ...over,
  };
}

describe('AuthService — mobile number normalization', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['  9876543210  ', '+919876543210'],
    ['+1 415 555 2671', '+14155552671'], // foreign number is not "corrected"
  ])('stores %s as %s', async (typed, canonical) => {
    const { service, prisma } = build();
    await service.startOtp(typed);
    expect(prisma.mobileOtp.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mobileNo: canonical } }),
    );
  });

  it('looks a number up under every spelling it may have been stored as', async () => {
    const { service, prisma } = build();
    await service.startOtp('9876543210');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        mobileNo: { in: ['+919876543210', '919876543210', '9876543210'] },
      },
    });
  });
});

describe('AuthService — startOtp', () => {
  it('reports a number with no account as new', async () => {
    const { service } = build();
    await expect(service.startOtp('9876543210')).resolves.toMatchObject({ isNewUser: true });
  });

  it('reports a number with an account as returning', async () => {
    const { service } = build({ user: ACTIVE_USER });
    await expect(service.startOtp('9876543210')).resolves.toMatchObject({ isNewUser: false });
  });

  it('masks the number in the response', async () => {
    const { service } = build();
    const result = await service.startOtp('9876543210');
    expect(result.mobileNo).toBe('********3210');
    expect(result.mobileNo).not.toContain('98765');
  });

  it('refuses a disabled account before sending anything', async () => {
    const { service, whatsapp } = build({ user: { ...ACTIVE_USER, isActive: false } });
    await expect(service.startOtp('9876543210')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
  });

  it('enforces the cooldown BEFORE spending a message', async () => {
    const { service, whatsapp } = build({ otp: liveOtp({ lastSentAt: new Date() }) });
    await expect(service.startOtp('9876543210')).rejects.toThrow(/wait \d+s/);
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
  });

  it('drops the pending code when delivery fails, so the visitor can retry at once', async () => {
    const send = jest.fn().mockRejectedValue(new Error('carrier down'));
    const { service, prisma } = build({ sendOtp: send });
    await expect(service.startOtp('9876543210')).rejects.toBeTruthy();
    expect(prisma.mobileOtp.delete).toHaveBeenCalledWith({
      where: { mobileNo: '+919876543210' },
    });
  });

  it('never stores the code in the clear', async () => {
    const { service, prisma } = build();
    await service.startOtp('9876543210');
    const stored = prisma.mobileOtp.upsert.mock.calls[0]![0].create.codeHash;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('AuthService — verifyOtp', () => {
  const verify = (over = {}) => ({ mobileNo: '9876543210', code: '123456', ...over });

  it('rejects when no code was ever requested', async () => {
    const { service } = build();
    await expect(service.verifyOtp(verify())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects and destroys an expired code', async () => {
    const { service, prisma } = build({
      otp: liveOtp({ expiresAt: new Date(Date.now() - 1000) }),
    });
    await expect(service.verifyOtp(verify())).rejects.toThrow(/expired/i);
    expect(prisma.mobileOtp.delete).toHaveBeenCalled();
  });

  it('rejects and destroys the code once the attempt cap is reached', async () => {
    const { service, prisma } = build({ otp: liveOtp({ attempts: 5 }) });
    await expect(service.verifyOtp(verify())).rejects.toThrow(/too many/i);
    expect(prisma.mobileOtp.delete).toHaveBeenCalled();
  });

  it('counts a wrong code without destroying it', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await expect(service.verifyOtp(verify({ code: '000000' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.mobileOtp.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.mobileOtp.delete).not.toHaveBeenCalled();
  });

  it('signs an existing account in without needing a name', async () => {
    const { service, prisma } = build({ otp: liveOtp(), user: ACTIVE_USER });
    const result = await service.verifyOtp(verify());
    expect(result).toHaveProperty('accessToken');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('never overwrites an existing account’s name on sign-in', async () => {
    const { service, prisma } = build({ otp: liveOtp(), user: ACTIVE_USER });
    await service.verifyOtp(verify({ name: 'Someone Else' }));
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Someone Else' }) }),
    );
  });

  it('refuses to create an account without a name', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await expect(service.verifyOtp(verify())).rejects.toThrow(/name/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a whitespace-only name', async () => {
    const { service } = build({ otp: liveOtp() });
    await expect(service.verifyOtp(verify({ name: '   ' }))).rejects.toThrow(/name/i);
  });

  it('rejects a disabled existing account', async () => {
    const { service } = build({ otp: liveOtp(), user: { ...ACTIVE_USER, isActive: false } });
    await expect(service.verifyOtp(verify())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('consumes the code on success so it cannot be replayed', async () => {
    const { service, prisma } = build({ otp: liveOtp(), user: ACTIVE_USER });
    await service.verifyOtp(verify());
    expect(prisma.mobileOtp.delete).toHaveBeenCalledWith({ where: { id: 'otp1' } });
  });

  it('surfaces a mobile taken between the lookup and the insert as a conflict', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '6',
      }),
    );
    await expect(service.verifyOtp(verify({ name: 'New Person' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('AuthService — account creation', () => {
  const verify = (name: string) => ({ mobileNo: '9876543210', code: '123456', name });

  it('splits a two-part name across firstName and lastName', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Vikram Mehta'));
    expect(prisma.user.create.mock.calls[0]![0].data).toMatchObject({
      firstName: 'Vikram',
      lastName: 'Mehta',
      name: 'Vikram Mehta',
    });
  });

  it('leaves lastName null for a single-word name', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Amit'));
    expect(prisma.user.create.mock.calls[0]![0].data).toMatchObject({
      firstName: 'Amit',
      lastName: null,
    });
  });

  it('keeps every middle name in lastName', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Rajesh Kumar Singh'));
    expect(prisma.user.create.mock.calls[0]![0].data).toMatchObject({
      firstName: 'Rajesh',
      lastName: 'Kumar Singh',
    });
  });

  it('collapses runaway whitespace', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('  Rita   Sharma  '));
    expect(prisma.user.create.mock.calls[0]![0].data).toMatchObject({
      firstName: 'Rita',
      lastName: 'Sharma',
    });
  });

  it('creates a RESELLER on the reseller storefront — no admin approval', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Rita Sharma'), 'reseller');
    expect(prisma.user.create.mock.calls[0]![0].data.role).toBe('RESELLER');
  });

  it('creates a CUSTOMER on the public storefront', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Rita Sharma'), 'web');
    expect(prisma.user.create.mock.calls[0]![0].data.role).toBe('CUSTOMER');
  });

  it('defaults to CUSTOMER when no storefront is supplied', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Rita Sharma'));
    expect(prisma.user.create.mock.calls[0]![0].data.role).toBe('CUSTOMER');
  });

  it('stores no email, password, city or state', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp(verify('Rita Sharma'));
    const data = prisma.user.create.mock.calls[0]![0].data;
    expect(data.email).toBeUndefined();
    expect(data.passwordHash).toBeUndefined();
    expect(data.city).toBeUndefined();
    expect(data.state).toBeUndefined();
  });

  it('stores the canonical mobile number, not what was typed', async () => {
    const { service, prisma } = build({ otp: liveOtp() });
    await service.verifyOtp({ mobileNo: '09876543210', code: '123456', name: 'Rita' });
    expect(prisma.user.create.mock.calls[0]![0].data.mobileNo).toBe('+919876543210');
  });
});

describe('AuthService — resendOtp', () => {
  it('rejects when nothing was requested for the number', async () => {
    const { service } = build();
    await expect(service.resendOtp('9876543210')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the cooldown', async () => {
    const { service, whatsapp } = build({ otp: liveOtp({ lastSentAt: new Date() }) });
    await expect(service.resendOtp('9876543210')).rejects.toThrow(/wait \d+s/);
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
  });

  it('issues a fresh code and resets the attempt counter', async () => {
    const { service, prisma } = build({ otp: liveOtp({ attempts: 3 }) });
    await service.resendOtp('9876543210');
    expect(prisma.mobileOtp.update.mock.calls[0]![0].data).toMatchObject({ attempts: 0 });
  });

  it('rolls the cooldown back when delivery fails', async () => {
    const previous = new Date(Date.now() - 120_000);
    const send = jest.fn().mockRejectedValue(new Error('carrier down'));
    const { service, prisma } = build({ otp: liveOtp({ lastSentAt: previous }), sendOtp: send });
    await expect(service.resendOtp('9876543210')).rejects.toBeTruthy();
    expect(prisma.mobileOtp.update).toHaveBeenLastCalledWith({
      where: { id: 'otp1' },
      data: { lastSentAt: previous },
    });
  });

  it('keeps the pending row on failure (unlike startOtp)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('carrier down'));
    const { service, prisma } = build({ otp: liveOtp(), sendOtp: send });
    await expect(service.resendOtp('9876543210')).rejects.toBeTruthy();
    expect(prisma.mobileOtp.delete).not.toHaveBeenCalled();
  });
});
