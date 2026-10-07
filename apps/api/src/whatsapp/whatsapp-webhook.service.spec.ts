import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const SECRET = 'app-secret-for-tests';
const VERIFY = 'verify-token-for-tests';
const sign = (body: Buffer, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

function build(values: Record<string, string> = { WHATSAPP_APP_SECRET: SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY }) {
  const service = new WhatsAppWebhookService(configWith(values));
  return { service, controller: new WhatsAppWebhookController(service) };
}

describe('WhatsAppWebhookService — GET verification', () => {
  it('echoes the challenge when mode and token match', () => {
    expect(build().service.verifyChallenge('subscribe', VERIFY, '12345')).toBe('12345');
  });

  it('rejects a wrong token, wrong mode or missing challenge', () => {
    const { service } = build();
    expect(() => service.verifyChallenge('subscribe', 'nope', '1')).toThrow(ForbiddenException);
    expect(() => service.verifyChallenge('unsubscribe', VERIFY, '1')).toThrow(ForbiddenException);
    expect(() => service.verifyChallenge('subscribe', VERIFY, undefined)).toThrow(ForbiddenException);
  });

  it('fails closed when no verify token is configured', () => {
    const { service } = build({});
    expect(() => service.verifyChallenge('subscribe', '', '1')).toThrow(ForbiddenException);
  });
});

describe('WhatsAppWebhookService — POST signature', () => {
  const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));

  it('accepts a correctly signed body', () => {
    expect(() => build().service.assertValidSignature(body, sign(body))).not.toThrow();
  });

  it('rejects a tampered body', () => {
    const tampered = Buffer.from(body.toString().replace('entry', 'entrz'));
    expect(() => build().service.assertValidSignature(tampered, sign(body))).toThrow(ForbiddenException);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(() => build().service.assertValidSignature(body, sign(body, 'other'))).toThrow(ForbiddenException);
  });

  it('rejects a missing or malformed header and a missing raw body', () => {
    const { service } = build();
    expect(() => service.assertValidSignature(body, undefined)).toThrow(ForbiddenException);
    expect(() => service.assertValidSignature(body, 'abc')).toThrow(ForbiddenException);
    expect(() => service.assertValidSignature(undefined, sign(body))).toThrow(ForbiddenException);
  });

  it('fails closed (503) when no app secret is configured', () => {
    expect(() => build({}).service.assertValidSignature(body, sign(body))).toThrow(ServiceUnavailableException);
  });
});

describe('WhatsAppWebhookService — handle()', () => {
  const statusPayload = (status: string, extra: object = {}) => ({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.X', status, recipient_id: '919876544135', ...extra }] } }] }],
  });

  it('logs delivery statuses with a masked number', () => {
    const { service } = build();
    const log = jest.spyOn(service['logger'], 'log').mockImplementation();
    service.handle(statusPayload('delivered'));
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain('status=delivered');
    expect(line).toContain('wamid.X');
    expect(line).not.toContain('919876544135');
  });

  it('logs failed statuses as errors with the Meta error code', () => {
    const { service } = build();
    const err = jest.spyOn(service['logger'], 'error').mockImplementation();
    service.handle(statusPayload('failed', { errors: [{ code: 131026, title: 'Undeliverable' }] }));
    expect(String(err.mock.calls[0]?.[0])).toContain('code=131026');
  });

  it('never throws on garbage input', () => {
    const { service } = build();
    jest.spyOn(service['logger'], 'error').mockImplementation();
    expect(() => service.handle(null)).not.toThrow();
    expect(() => service.handle('x')).not.toThrow();
    expect(() => service.handle({ object: 'whatsapp_business_account', entry: 5 })).not.toThrow();
  });
});

describe('WhatsAppWebhookController', () => {
  it('POST returns 200 body only after the signature checks out', () => {
    const { controller } = build();
    const raw = Buffer.from('{"object":"x"}');
    const req = { rawBody: raw } as never;
    expect(controller.receive(req, sign(raw), {})).toEqual({ received: true });
    expect(() => controller.receive(req, 'sha256=bad', {})).toThrow(ForbiddenException);
  });

  it('GET passes the Meta query params through to the challenge check', () => {
    expect(build().controller.verify('subscribe', VERIFY, 'abc')).toBe('abc');
  });
});
