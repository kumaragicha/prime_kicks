import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** A delivery receipt Meta sends for every message we post (sent → delivered → read, or failed). */
interface WebhookStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

interface WebhookChange {
  field?: string;
  value?: {
    statuses?: WebhookStatus[];
    messages?: unknown[];
    [key: string]: unknown;
  };
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: WebhookChange[] }>;
}

/** Compare two strings without leaking where they differ through timing. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Enough of a phone number to correlate a log line, not enough to leak it. */
function maskPhone(raw?: string): string {
  if (!raw) return 'n/a';
  return raw.length <= 4 ? '****' : `${raw.slice(0, 2)}${'*'.repeat(raw.length - 6)}${raw.slice(-4)}`;
}

/**
 * Handles Meta's WhatsApp webhook: the one-time GET verification handshake and
 * the signed POST event deliveries.
 *
 * Meta's rules, all enforced here:
 *   • GET: echo `hub.challenge` only when `hub.verify_token` matches ours
 *   • POST: authenticate with `X-Hub-Signature-256` = "sha256=" + HMAC-SHA256 of
 *     the RAW body keyed with the App Secret — never trust an unsigned payload
 *   • Both fail CLOSED when the matching env var is unset
 *
 * Processing is deliberately log-only for now (no DB writes): it makes delivery
 * failures visible, which was the gap documented in docs/whatsapp-otp.md.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(private readonly config: ConfigService) {}

  /** GET handshake. Returns the challenge to echo, or throws 403. */
  verifyChallenge(mode?: string, token?: string, challenge?: string): string {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!expected) {
      this.logger.error('Webhook verification refused — WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set.');
      throw new ForbiddenException('Webhook verification is not configured.');
    }
    if (mode !== 'subscribe' || !token || !challenge || !safeEqual(token, expected)) {
      this.logger.warn('Webhook verification refused — bad mode or verify token.');
      throw new ForbiddenException('Verification failed.');
    }
    this.logger.log('Webhook verified by Meta.');
    return challenge;
  }

  /** Throws unless `signatureHeader` is a valid HMAC of `rawBody` under the App Secret. */
  assertValidSignature(rawBody: Buffer | undefined, signatureHeader?: string): void {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) {
      this.logger.error('Webhook POST refused — WHATSAPP_APP_SECRET is not set.');
      throw new ServiceUnavailableException('Webhook signature check is not configured.');
    }
    if (!rawBody || !signatureHeader?.startsWith('sha256=')) {
      throw new ForbiddenException('Missing signature.');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqual(signatureHeader.slice('sha256='.length), expected)) {
      this.logger.warn('Webhook POST refused — signature mismatch.');
      throw new ForbiddenException('Invalid signature.');
    }
  }

  /**
   * Process a verified payload. Never throws: Meta retries any non-200 for days,
   * and a bad event must not turn into a retry storm.
   */
  handle(payload: unknown): void {
    try {
      const body = payload as WebhookPayload;
      if (body?.object !== 'whatsapp_business_account') return;
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          this.handleChange(entry.id, change);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to process webhook payload: ${(err as Error).message}`);
    }
  }

  private handleChange(wabaId: string | undefined, change: WebhookChange): void {
    const value = change.value ?? {};
    if (change.field === 'messages') {
      for (const s of value.statuses ?? []) this.logStatus(s);
      // Inbound customer messages are not used yet; count only (content is PII).
      if (value.messages?.length) {
        this.logger.log(`Inbound WhatsApp message(s): ${value.messages.length} (not processed).`);
      }
      return;
    }
    // account_review_update, message_template_status_update, phone_number_*, etc.
    this.logger.log(`WhatsApp ${change.field ?? 'unknown'} event for WABA ${wabaId ?? 'n/a'}: ${JSON.stringify(value)}`);
  }

  private logStatus(s: WebhookStatus): void {
    const line = `WhatsApp delivery status=${s.status ?? 'unknown'} messageId=${s.id ?? 'n/a'} to=${maskPhone(s.recipient_id)}`;
    if (s.status === 'failed') {
      const e = s.errors?.[0];
      this.logger.error(`${line} code=${e?.code ?? 'n/a'} reason="${e?.title ?? e?.message ?? 'n/a'}"`);
    } else {
      this.logger.log(line);
    }
  }
}
