import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOtpTemplateMessage } from './templates/otp.template';
import { WhatsAppSendError } from './whatsapp.error';
import type {
  CloudApiErrorResponse,
  CloudApiSendResponse,
  WhatsAppSendResult,
} from './whatsapp.types';

/** Graph API version pinned by default — bump deliberately, never implicitly. */
const DEFAULT_API_VERSION = 'v22.0';
const DEFAULT_TEMPLATE_NAME = 'prime_kicks_otp';
const DEFAULT_TEMPLATE_LANG = 'en';
/** Prime Kicks sells in India, so a bare 10-digit number is assumed to be Indian. */
const DEFAULT_COUNTRY_CODE = '91';
const DEFAULT_TIMEOUT_MS = 10_000;
/** Retries are for transient faults only; a rejected message is never re-sent blindly. */
const MAX_NETWORK_RETRIES = 2;
const RETRY_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends WhatsApp messages through the Meta Cloud API.
 *
 * Configured entirely from WHATSAPP_* env vars. When the required ones are
 * absent the service degrades to logging the message instead of throwing —
 * the same contract MailService offers, so local development and CI work with
 * zero WhatsApp setup. That fallback is refused in production (see `simulate`),
 * because silently not sending a login code is far worse than a loud failure.
 *
 * Two rules hold throughout:
 *   • the OTP code is never logged, EXCEPT via the explicit OTP_LOG_CODES
 *     debugging switch, which is refused when NODE_ENV=production
 *   • phone numbers are masked in logs — enough to correlate, not enough to leak
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly phoneNumberId: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly apiVersion: string;
  private readonly templateName: string;
  private readonly templateLang: string;
  private readonly defaultCountryCode: string;
  /** Print OTP codes to the server log — a debugging aid, never on in production. */
  private readonly logCodes: boolean;

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || undefined;
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || undefined;
    this.apiVersion = this.config.get<string>('WHATSAPP_API_VERSION', DEFAULT_API_VERSION);
    this.templateName = this.config.get<string>('WHATSAPP_OTP_TEMPLATE', DEFAULT_TEMPLATE_NAME);
    this.templateLang = this.config.get<string>(
      'WHATSAPP_OTP_TEMPLATE_LANG',
      DEFAULT_TEMPLATE_LANG,
    );
    this.defaultCountryCode = this.config.get<string>(
      'WHATSAPP_DEFAULT_COUNTRY_CODE',
      DEFAULT_COUNTRY_CODE,
    );
    this.logCodes = this.resolveLogCodes();

    // Log the effective config at boot (token masked) so a mis-set env var is
    // obvious immediately rather than at the first signup attempt.
    if (this.isConfigured) {
      this.logger.log(
        `WhatsApp Cloud API configured — phoneNumberId=${this.phoneNumberId} ` +
          `apiVersion=${this.apiVersion} template="${this.templateName}" ` +
          `lang=${this.templateLang} defaultCountryCode=+${this.defaultCountryCode} ` +
          `token=${this.maskToken(this.accessToken!)}`,
      );
    } else {
      const missing = [
        !this.phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
        !this.accessToken && 'WHATSAPP_ACCESS_TOKEN',
      ].filter(Boolean);
      this.logger.warn(
        `WhatsApp is NOT configured (missing: ${missing.join(', ')}). ` +
          'OTP codes will be logged to the console instead of sent. ' +
          'This is refused when NODE_ENV=production.',
      );
    }
  }

  /**
   * Decide whether OTP codes may be written to the log.
   *
   * A logged code IS a login: anyone who can read the server log can sign in as
   * that person. So this is opt-in via OTP_LOG_CODES and **hard-refused in
   * production**, where setting it is assumed to be a mistake rather than an
   * instruction — the flag is ignored and the attempt is logged loudly.
   *
   * It exists because the Meta test WABA cannot send an authentication template
   * (see docs/whatsapp-otp.md): with real credentials configured the send fails,
   * so without this there is no way to obtain a code and exercise the flow.
   */
  private resolveLogCodes(): boolean {
    const requested = this.config.get<string>('OTP_LOG_CODES') === 'true';
    if (!requested) return false;

    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.error(
        'OTP_LOG_CODES=true is set but NODE_ENV=production — REFUSING to log OTP codes. ' +
          'A logged code is a working login for that account. Unset it.',
      );
      return false;
    }

    this.logger.warn(
      'OTP_LOG_CODES=true — one-time codes WILL be printed to this log. ' +
        'Debugging only; never enable this on a shared or deployed environment.',
    );
    return true;
  }

  /** True when both required credentials are present. */
  get isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  /**
   * Send a one-time code to a mobile number over WhatsApp.
   *
   * Throws {@link WhatsAppSendError} when the message could not be handed to
   * Meta. A resolved result means Meta *accepted* the message — not that it was
   * delivered. Delivery is only knowable from webhooks (see docs/whatsapp-otp.md).
   */
  async sendOtp(mobileNo: string, code: string): Promise<WhatsAppSendResult> {
    const to = this.toE164Digits(mobileNo);
    const masked = this.maskPhone(to);

    this.logger.log(`[OTP 1/5] Preparing WhatsApp OTP → to=${masked} template="${this.templateName}"`);

    // Logged BEFORE the send, deliberately: the reason this switch exists is that
    // the send may fail (no authentication template on a test WABA), and a code
    // logged only on success would be useless for testing exactly that case.
    if (this.logCodes) {
      this.logger.warn(`[OTP CODE] to=${masked} code=${code}  ← OTP_LOG_CODES is enabled`);
    }

    if (!this.isConfigured) {
      return this.simulate(masked, code);
    }

    const payload = buildOtpTemplateMessage({
      to,
      templateName: this.templateName,
      languageCode: this.templateLang,
      code,
    });

    // Log the payload with the code redacted — the shape is what you need when
    // debugging a 132000 parameter mismatch; the code itself must never appear.
    this.logger.debug(`[OTP 2/5] Payload (code redacted): ${this.redactCode(payload, code)}`);

    const result = await this.post(payload, masked);

    this.logger.log(
      `[OTP 5/5] WhatsApp OTP ACCEPTED by Meta → to=${masked} ` +
        `messageId=${result.messageId ?? 'n/a'} waId=${result.waId ? this.maskPhone(result.waId) : 'n/a'} ` +
        `status=${result.status ?? 'n/a'}`,
    );

    // No wa_id means WhatsApp could not resolve the number to an account. Meta
    // still returns 200, so this is the only early signal that the code is going
    // nowhere — worth a loud warning rather than a silent success.
    if (!result.waId) {
      this.logger.warn(
        `WhatsApp accepted the message for ${masked} but returned no wa_id — ` +
          'the number may not have a WhatsApp account. The code will not arrive.',
      );
    }

    return result;
  }

  /**
   * POST the message to the Cloud API, with a hard timeout and bounded retries.
   *
   * Retries cover only cases where the message was provably NOT sent (connection
   * failure, timeout, 5xx) or where Meta told us to back off. A 4xx rejection is
   * final — retrying it would just burn the rate limit.
   */
  private async post(payload: Record<string, unknown>, masked: string): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const body = JSON.stringify(payload);
    let lastError: WhatsAppSendError | undefined;

    for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
      const label = `attempt ${attempt + 1}/${MAX_NETWORK_RETRIES + 1}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs());
      const startedAt = Date.now();
      let res: Response;

      this.logger.log(`[OTP 3/5] POST ${url} → to=${masked} (${label})`);

      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: controller.signal,
        });
      } catch (error) {
        // No response at all — the message definitely was not sent, so retrying
        // cannot duplicate it.
        const aborted = controller.signal.aborted;
        const detail = aborted
          ? `request timed out after ${this.timeoutMs()}ms`
          : error instanceof Error
            ? error.message
            : String(error);

        lastError = new WhatsAppSendError({
          message: `Could not reach the WhatsApp Cloud API: ${detail}`,
          kind: 'transient',
          hint: 'Network failure or timeout reaching graph.facebook.com. Check egress/DNS.',
        });
        this.logger.warn(`[OTP 3/5] NETWORK ERROR → to=${masked} (${label}): ${detail}`);

        if (attempt < MAX_NETWORK_RETRIES) {
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
          continue;
        }
        this.logger.error(`WhatsApp send GAVE UP → to=${masked} — ${lastError.describe()}`);
        throw lastError;
      } finally {
        clearTimeout(timer);
      }

      const ms = Date.now() - startedAt;
      const text = await res.text();
      this.logger.log(`[OTP 4/5] Response → to=${masked} status=${res.status} (${ms}ms)`);
      this.logger.debug(`[OTP 4/5] Raw body: ${text || '(empty)'}`);

      let parsed: (CloudApiSendResponse & CloudApiErrorResponse) | undefined;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        // Non-JSON body. Meta shouldn't do this; treat as transient so a proxy
        // returning an HTML error page doesn't permanently fail a signup.
        lastError = new WhatsAppSendError({
          message: `WhatsApp returned a non-JSON response (HTTP ${res.status})`,
          kind: 'transient',
          hint: 'A proxy or gateway may be intercepting the request.',
          httpStatus: res.status,
        });
        this.logger.warn(`[OTP 4/5] NON-JSON body → to=${masked}: ${text.slice(0, 200)}`);
        if (attempt < MAX_NETWORK_RETRIES) {
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      // Meta signals failure via the `error` envelope, which can appear even on
      // a 200 — so check the body, not just the status code.
      if (!res.ok || parsed?.error) {
        const failure = WhatsAppSendError.fromCloudApi(parsed ?? {}, res.status);
        this.logger.error(`WhatsApp send REJECTED → to=${masked} ${failure.describe()}`);

        if (failure.retryable && attempt < MAX_NETWORK_RETRIES) {
          this.logger.warn(`Retrying after a ${failure.kind} failure → to=${masked}`);
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
          lastError = failure;
          continue;
        }
        throw failure;
      }

      const message = parsed?.messages?.[0];
      const contact = parsed?.contacts?.[0];
      return {
        accepted: true,
        messageId: message?.id,
        waId: contact?.wa_id,
        status: message?.message_status,
        simulated: false,
      };
    }

    // Unreachable — the loop always returns or throws — but keeps TS exhaustive.
    throw (
      lastError ??
      new WhatsAppSendError({
        message: 'WhatsApp send failed for an unknown reason',
        kind: 'unknown',
        hint: 'No response and no error was captured.',
      })
    );
  }

  /**
   * Development fallback: print the code to the console instead of sending it.
   *
   * This is the ONLY place the code is logged, and it is hard-refused in
   * production — a misconfigured prod deploy must fail loudly, not hand out
   * login codes to whoever can read the logs.
   */
  private simulate(masked: string, code: string): WhatsAppSendResult {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new WhatsAppSendError({
        message: 'WhatsApp is not configured',
        kind: 'configuration',
        hint:
          'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN. ' +
          'The console fallback is disabled in production.',
      });
    }

    this.logger.warn(
      `[DEV WHATSAPP — not configured, nothing sent] to=${masked} code=${code} ` +
        `template="${this.templateName}"`,
    );
    return { accepted: true, simulated: true };
  }

  /**
   * Normalize a mobile number to the digits-only E.164 form the Cloud API wants
   * (country code included, no `+`, no spaces or punctuation).
   *
   * A bare 10-digit number is assumed to be in WHATSAPP_DEFAULT_COUNTRY_CODE.
   * Anything already carrying a country code is passed through untouched — we
   * deliberately do not "correct" it, since guessing wrong sends the code to a
   * stranger.
   */
  private toE164Digits(mobileNo: string): string {
    const digits = mobileNo.replace(/\D/g, '');

    // Indian numbers are frequently stored with a 0 trunk prefix (09876543210).
    const trimmed =
      digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;

    if (trimmed.length === 10) return `${this.defaultCountryCode}${trimmed}`;
    return trimmed;
  }

  private timeoutMs(): number {
    const raw = Number(this.config.get<string>('WHATSAPP_TIMEOUT_MS'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
  }

  /** Mask all but the last 4 digits, e.g. "91******3210". */
  private maskPhone(value: string): string {
    if (value.length <= 4) return '****';
    const cc = value.slice(0, 2);
    const tail = value.slice(-4);
    return `${cc}${'*'.repeat(Math.max(0, value.length - 6))}${tail}`;
  }

  /** Show only the ends of a token, enough to tell two tokens apart in a log. */
  private maskToken(value: string): string {
    if (value.length <= 12) return '***';
    return `${value.slice(0, 6)}…${value.slice(-4)} (len=${value.length})`;
  }

  /** Serialize a payload for logging with every occurrence of the code removed. */
  private redactCode(payload: Record<string, unknown>, code: string): string {
    return JSON.stringify(payload).split(code).join('******');
  }
}
