import { ConfigService } from '@nestjs/config';
import { WhatsAppSendError } from './whatsapp.error';
import { WhatsAppService } from './whatsapp.service';

/** Minimal ConfigService stand-in backed by a plain map. */
function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

const CONFIGURED = {
  WHATSAPP_PHONE_NUMBER_ID: '1268449313024551',
  WHATSAPP_ACCESS_TOKEN: 'test-token-value-long-enough-to-mask',
  WHATSAPP_OTP_TEMPLATE: 'prime_kicks_otp',
  WHATSAPP_OTP_TEMPLATE_LANG: 'en',
  WHATSAPP_DEFAULT_COUNTRY_CODE: '91',
  WHATSAPP_TIMEOUT_MS: '1000',
};

/** Build a fetch stub returning the given status/body, recording every call. */
function stubFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls, fn };
}

/** Parsed request body of the first recorded call. Throws if nothing was sent. */
function firstBody(calls: Array<{ url: string; init: RequestInit }>) {
  const first = calls[0];
  if (!first) throw new Error('expected a request to have been made, but none was');
  return JSON.parse(first.init.body as string);
}

const OK_BODY = {
  messaging_product: 'whatsapp',
  contacts: [{ input: '919876543210', wa_id: '919876543210' }],
  messages: [{ id: 'wamid.TEST', message_status: 'accepted' }],
};

describe('WhatsAppService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  describe('configuration', () => {
    it('reports configured when both credentials are present', () => {
      expect(new WhatsAppService(configWith(CONFIGURED)).isConfigured).toBe(true);
    });

    it('reports unconfigured when the token is missing', () => {
      const { WHATSAPP_ACCESS_TOKEN: _omitted, ...rest } = CONFIGURED;
      expect(new WhatsAppService(configWith(rest)).isConfigured).toBe(false);
    });

    it('treats an empty-string credential as missing, not as a value', () => {
      const service = new WhatsAppService(
        configWith({ ...CONFIGURED, WHATSAPP_ACCESS_TOKEN: '' }),
      );
      expect(service.isConfigured).toBe(false);
    });
  });

  describe('phone number normalization', () => {
    const cases: Array<[string, string]> = [
      ['9876543210', '919876543210'], // bare 10-digit → default country code
      ['09876543210', '919876543210'], // leading trunk 0 stripped
      ['+919876543210', '919876543210'], // already E.164
      ['+91 98765 43210', '919876543210'], // spaces
      ['+91-98765-43210', '919876543210'], // hyphens
      ['919876543210', '919876543210'], // digits with country code
      ['+14155552671', '14155552671'], // non-Indian passed through untouched
    ];

    it.each(cases)('normalizes %s → %s', async (input, expected) => {
      const { calls } = stubFetch(200, OK_BODY);
      await new WhatsAppService(configWith(CONFIGURED)).sendOtp(input, '123456');
      expect(firstBody(calls).to).toBe(expected);
    });
  });

  describe('payload', () => {
    it('sends the code as BOTH the body parameter and the copy-code button parameter', async () => {
      const { calls } = stubFetch(200, OK_BODY);
      await new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456');

      const body = firstBody(calls);
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('prime_kicks_otp');
      expect(body.template.language.code).toBe('en');

      const [bodyComponent, buttonComponent] = body.template.components;
      expect(bodyComponent).toEqual({
        type: 'body',
        parameters: [{ type: 'text', text: '123456' }],
      });
      expect(buttonComponent).toEqual({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: '123456' }],
      });
    });

    it('posts to the configured phone number id and API version', async () => {
      const { calls } = stubFetch(200, OK_BODY);
      await new WhatsAppService(
        configWith({ ...CONFIGURED, WHATSAPP_API_VERSION: 'v21.0' }),
      ).sendOtp('9876543210', '123456');

      expect(calls[0]?.url).toBe(
        'https://graph.facebook.com/v21.0/1268449313024551/messages',
      );
    });

    it('returns the message id and wa_id from an accepted send', async () => {
      stubFetch(200, OK_BODY);
      const result = await new WhatsAppService(configWith(CONFIGURED)).sendOtp(
        '9876543210',
        '123456',
      );
      expect(result).toEqual({
        accepted: true,
        messageId: 'wamid.TEST',
        waId: '919876543210',
        status: 'accepted',
        simulated: false,
      });
    });
  });

  describe('error mapping', () => {
    const send = (status: number, body: unknown) => {
      stubFetch(status, body);
      return new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456');
    };

    it('maps an expired token to a non-retryable configuration failure', async () => {
      await expect(
        send(401, { error: { code: 190, message: 'Session expired', fbtrace_id: 'AX1' } }),
      ).rejects.toMatchObject({ kind: 'configuration', code: 190, retryable: false });
    });

    it('maps a missing template to a configuration failure', async () => {
      await expect(
        send(400, { error: { code: 132001, message: 'Template does not exist' } }),
      ).rejects.toMatchObject({ kind: 'configuration', retryable: false });
    });

    it('maps an undeliverable recipient to a recipient failure', async () => {
      await expect(
        send(400, { error: { code: 131026, message: 'Message undeliverable' } }),
      ).rejects.toMatchObject({ kind: 'recipient', retryable: false });
    });

    it('maps a rate limit to a retryable failure', async () => {
      await expect(
        send(429, { error: { code: 130429, message: 'Rate limit hit' } }),
      ).rejects.toMatchObject({ kind: 'rate_limited', retryable: true });
    });

    it('treats an unrecognised 5xx code as transient', async () => {
      await expect(
        send(500, { error: { code: 999999, message: 'Something broke' } }),
      ).rejects.toMatchObject({ kind: 'transient', retryable: true });
    });

    it('treats an unrecognised 4xx code as unknown and does not retry it', async () => {
      await expect(
        send(400, { error: { code: 999999, message: 'Something odd' } }),
      ).rejects.toMatchObject({ kind: 'unknown', retryable: false });
    });

    it('detects an error envelope returned with HTTP 200', async () => {
      await expect(send(200, { error: { code: 131026, message: 'Undeliverable' } })).rejects.toBeInstanceOf(
        WhatsAppSendError,
      );
    });

    it('keeps fbtrace_id for support tickets', async () => {
      await expect(
        send(400, { error: { code: 131026, fbtrace_id: 'TRACE-123' } }),
      ).rejects.toMatchObject({ fbtraceId: 'TRACE-123' });
    });
  });

  describe('retries', () => {
    it('does not retry a final 4xx rejection', async () => {
      const { fn } = stubFetch(400, { error: { code: 131026 } });
      await expect(
        new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456'),
      ).rejects.toBeInstanceOf(WhatsAppSendError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries a rate-limited send up to the cap, then gives up', async () => {
      const { fn } = stubFetch(429, { error: { code: 130429 } });
      await expect(
        new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456'),
      ).rejects.toMatchObject({ kind: 'rate_limited' });
      expect(fn).toHaveBeenCalledTimes(3); // initial + MAX_NETWORK_RETRIES
    });

    it('retries a network failure and succeeds on a later attempt', async () => {
      let attempt = 0;
      global.fetch = jest.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('ECONNRESET');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(OK_BODY),
        } as Response;
      }) as unknown as typeof fetch;

      const result = await new WhatsAppService(configWith(CONFIGURED)).sendOtp(
        '9876543210',
        '123456',
      );
      expect(result.accepted).toBe(true);
      expect(attempt).toBe(2);
    });

    it('surfaces a transient failure when every attempt fails', async () => {
      global.fetch = jest.fn(async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch;

      await expect(
        new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456'),
      ).rejects.toMatchObject({ kind: 'transient', retryable: true });
    });

    it('treats a non-JSON body as transient rather than failing permanently', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      })) as unknown as typeof fetch;

      await expect(
        new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '123456'),
      ).rejects.toMatchObject({ kind: 'transient' });
    });
  });

  describe('unconfigured fallback', () => {
    it('simulates the send outside production instead of throwing', async () => {
      const service = new WhatsAppService(configWith({ NODE_ENV: 'development' }));
      const result = await service.sendOtp('9876543210', '123456');
      expect(result).toEqual({ accepted: true, simulated: true });
    });

    it('refuses to simulate in production', async () => {
      const service = new WhatsAppService(configWith({ NODE_ENV: 'production' }));
      await expect(service.sendOtp('9876543210', '123456')).rejects.toMatchObject({
        kind: 'configuration',
      });
    });

    it('makes no network call when unconfigured', async () => {
      const { fn } = stubFetch(200, OK_BODY);
      await new WhatsAppService(configWith({ NODE_ENV: 'test' })).sendOtp('9876543210', '1');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('OTP_LOG_CODES', () => {
    const capture = () => {
      const written: string[] = [];
      const push = (...args: unknown[]) => void written.push(String(args[0]));
      const { Logger } = require('@nestjs/common');
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(push);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(push);
      jest.spyOn(Logger.prototype, 'error').mockImplementation(push);
      return written;
    };

    it('prints the code when explicitly enabled outside production', async () => {
      stubFetch(200, OK_BODY);
      const written = capture();
      await new WhatsAppService(
        configWith({ ...CONFIGURED, OTP_LOG_CODES: 'true', NODE_ENV: 'development' }),
      ).sendOtp('9876543210', '424242');
      expect(written.join('\n')).toContain('424242');
    });

    it('REFUSES to print the code in production, even when enabled', async () => {
      stubFetch(200, OK_BODY);
      const written = capture();
      await new WhatsAppService(
        configWith({ ...CONFIGURED, OTP_LOG_CODES: 'true', NODE_ENV: 'production' }),
      ).sendOtp('9876543210', '424242');
      const out = written.join('\n');
      expect(out).not.toContain('424242');
      expect(out).toContain('REFUSING to log OTP codes');
    });

    it('stays off unless the value is exactly "true"', async () => {
      for (const value of ['1', 'yes', 'TRUE', '']) {
        stubFetch(200, OK_BODY);
        const written = capture();
        await new WhatsAppService(
          configWith({ ...CONFIGURED, OTP_LOG_CODES: value, NODE_ENV: 'development' }),
        ).sendOtp('9876543210', '424242');
        expect(written.join('\n')).not.toContain('424242');
        jest.restoreAllMocks();
      }
    });

    it('prints the code even when the send then fails — the reason it exists', async () => {
      stubFetch(400, { error: { code: 132001, message: 'Template does not exist' } });
      const written = capture();
      await expect(
        new WhatsAppService(
          configWith({ ...CONFIGURED, OTP_LOG_CODES: 'true', NODE_ENV: 'development' }),
        ).sendOtp('9876543210', '424242'),
      ).rejects.toBeInstanceOf(WhatsAppSendError);
      expect(written.join('\n')).toContain('424242');
    });
  });

  describe('secret hygiene', () => {
    it('never writes the OTP code to the log on a successful send', async () => {
      stubFetch(200, OK_BODY);
      const written: string[] = [];
      jest
        .spyOn(require('@nestjs/common').Logger.prototype, 'log')
        .mockImplementation((...args: unknown[]) => written.push(String(args[0])));
      jest
        .spyOn(require('@nestjs/common').Logger.prototype, 'debug')
        .mockImplementation((...args: unknown[]) => written.push(String(args[0])));

      await new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '424242');

      expect(written.join('\n')).not.toContain('424242');
    });

    it('never writes the full phone number to the log', async () => {
      stubFetch(200, OK_BODY);
      const written: string[] = [];
      jest
        .spyOn(require('@nestjs/common').Logger.prototype, 'log')
        .mockImplementation((...args: unknown[]) => written.push(String(args[0])));

      await new WhatsAppService(configWith(CONFIGURED)).sendOtp('9876543210', '424242');

      expect(written.join('\n')).not.toContain('9876543210');
      expect(written.join('\n')).toContain('3210'); // last 4 kept for correlation
    });
  });
});
