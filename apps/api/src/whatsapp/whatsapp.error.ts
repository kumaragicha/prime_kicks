import type { CloudApiErrorResponse, WhatsAppFailureKind } from './whatsapp.types';

/**
 * Meta error codes we treat specially. Anything not listed falls through to
 * `unknown`, which is non-retryable — a new code we haven't seen should surface
 * loudly rather than be silently retried.
 *
 * Codes are documented at developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 * and do change; the `unknown` fallback keeps an unrecognised code from crashing us.
 */
const ERROR_CODES: Record<number, { kind: WhatsAppFailureKind; hint: string }> = {
  0: { kind: 'configuration', hint: 'Authentication failed — check WHATSAPP_ACCESS_TOKEN.' },
  3: {
    kind: 'configuration',
    hint: 'The app/token lacks the whatsapp_business_messaging permission.',
  },
  10: {
    kind: 'configuration',
    hint: 'The app does not have permission for this action on this WABA.',
  },
  190: {
    kind: 'configuration',
    hint: 'Access token is invalid or expired. Temporary tokens last 24h — use a System User token.',
  },
  200: { kind: 'configuration', hint: 'The token is missing a required permission.' },
  100: {
    kind: 'configuration',
    hint: 'Invalid request parameter — usually a wrong PHONE_NUMBER_ID or a malformed payload.',
  },
  131_000: { kind: 'transient', hint: 'Meta-side internal error. Safe to retry.' },
  131_005: { kind: 'configuration', hint: 'Access denied to this phone number.' },
  131_008: { kind: 'configuration', hint: 'A required payload parameter is missing.' },
  131_009: { kind: 'configuration', hint: 'A payload parameter has an unsupported value.' },
  131_016: { kind: 'transient', hint: 'WhatsApp service temporarily unavailable. Safe to retry.' },
  131_021: {
    kind: 'recipient',
    hint: 'Recipient and sender are the same number — a number cannot message itself.',
  },
  131_026: {
    kind: 'recipient',
    hint:
      'Message undeliverable — the number has no WhatsApp account, is not reachable, ' +
      'or (on a test number) is not in the allowed recipients list.',
  },
  131_030: {
    kind: 'recipient',
    hint: 'Recipient is not in the test number\'s allowed list. Add it in Meta → API Setup → To.',
  },
  131_047: {
    kind: 'recipient',
    hint: 'Re-engagement required — outside the 24h window a template message is mandatory.',
  },
  131_049: {
    kind: 'rate_limited',
    hint: 'Meta withheld the message for healthy-ecosystem limits. Retry later.',
  },
  131_053: { kind: 'configuration', hint: 'Media upload error.' },
  132_000: {
    kind: 'configuration',
    hint: 'Template parameter count mismatch — the payload does not match the approved template.',
  },
  132_001: {
    kind: 'configuration',
    hint:
      'Template does not exist, is not APPROVED, or the language code is wrong. ' +
      'Check WHATSAPP_OTP_TEMPLATE and WHATSAPP_OTP_TEMPLATE_LANG.',
  },
  132_005: { kind: 'configuration', hint: 'Translated template text is too long.' },
  132_007: { kind: 'configuration', hint: 'Template content violates WhatsApp policy.' },
  132_012: { kind: 'configuration', hint: 'Template parameter format mismatch.' },
  132_015: { kind: 'configuration', hint: 'Template is paused due to poor quality.' },
  132_016: { kind: 'configuration', hint: 'Template is permanently disabled for quality.' },
  133_010: { kind: 'configuration', hint: 'Phone number is not registered on the Cloud API.' },
  133_015: { kind: 'transient', hint: 'Phone number is being deregistered. Retry shortly.' },
  80_007: { kind: 'rate_limited', hint: 'WABA rate limit hit. Retry later.' },
  130_429: { kind: 'rate_limited', hint: 'Cloud API message throughput limit hit. Retry later.' },
  131_048: {
    kind: 'rate_limited',
    hint: 'Spam rate limit hit — too many messages to users who have not replied.',
  },
  368: { kind: 'configuration', hint: 'Temporarily blocked for policy violations.' },
};

/**
 * A failed WhatsApp send, carrying enough detail to diagnose it from logs alone.
 *
 * This is deliberately NOT an HttpException: the caller decides what the end user
 * sees. Leaking Meta's wording to a signup form would be both confusing and a
 * small information disclosure about our infrastructure.
 */
export class WhatsAppSendError extends Error {
  readonly kind: WhatsAppFailureKind;
  /** Operator-facing explanation of the likely cause and fix. */
  readonly hint: string;
  readonly code?: number;
  readonly subcode?: number;
  /** Meta's correlation id — include it in any support ticket. */
  readonly fbtraceId?: string;
  readonly httpStatus?: number;

  constructor(init: {
    message: string;
    kind: WhatsAppFailureKind;
    hint: string;
    code?: number;
    subcode?: number;
    fbtraceId?: string;
    httpStatus?: number;
  }) {
    super(init.message);
    this.name = 'WhatsAppSendError';
    this.kind = init.kind;
    this.hint = init.hint;
    this.code = init.code;
    this.subcode = init.subcode;
    this.fbtraceId = init.fbtraceId;
    this.httpStatus = init.httpStatus;
  }

  /** True when the same request has a realistic chance of succeeding later. */
  get retryable(): boolean {
    return this.kind === 'transient' || this.kind === 'rate_limited';
  }

  /** Single-line form for logs — every field that helps diagnosis, nothing that identifies a user. */
  describe(): string {
    return [
      `kind=${this.kind}`,
      this.httpStatus !== undefined && `httpStatus=${this.httpStatus}`,
      this.code !== undefined && `code=${this.code}`,
      this.subcode !== undefined && `subcode=${this.subcode}`,
      `message="${this.message}"`,
      `hint="${this.hint}"`,
      this.fbtraceId && `fbtrace_id=${this.fbtraceId}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Build from Meta's error envelope, mapping the code to a kind and a fix hint. */
  static fromCloudApi(body: CloudApiErrorResponse, httpStatus: number): WhatsAppSendError {
    const error = body.error ?? {};
    const mapped = error.code !== undefined ? ERROR_CODES[error.code] : undefined;

    // A 5xx with no recognised code is still worth retrying — Meta's fault, not ours.
    const kind: WhatsAppFailureKind =
      mapped?.kind ?? (httpStatus >= 500 ? 'transient' : 'unknown');

    const hint =
      mapped?.hint ??
      error.error_user_msg ??
      error.error_data?.details ??
      'Unrecognised Cloud API error — check Meta\'s error-code reference for this code.';

    const message =
      error.error_user_msg ?? error.message ?? `WhatsApp API returned HTTP ${httpStatus}`;

    return new WhatsAppSendError({
      message,
      kind,
      hint,
      code: error.code,
      subcode: error.error_subcode,
      fbtraceId: error.fbtrace_id,
      httpStatus,
    });
  }
}
