/**
 * Shapes exchanged with the Meta WhatsApp Cloud API. Only the fields we actually
 * read are modelled — Meta returns considerably more.
 */

/** A `messages` response: one contact + one message per recipient we sent to. */
export interface CloudApiSendResponse {
  messaging_product?: string;
  contacts?: Array<{
    /** The number as WhatsApp normalized it — may differ from what we sent. */
    input?: string;
    /** WhatsApp's own id for the contact. Absent when the number has no account. */
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    /**
     * `accepted` | `held_for_quality_assessment` — present on newer API versions.
     * NOT a delivery confirmation: it only means Meta queued the message.
     */
    message_status?: string;
  }>;
}

/** Meta's standard error envelope, returned with 4xx/5xx (and occasionally 200). */
export interface CloudApiErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    /** Short title safe to show a human operator (not the end user). */
    error_user_title?: string;
    /** Human-readable cause, when Meta provides one. */
    error_user_msg?: string;
    /** Correlation id — quote this when raising a support ticket with Meta. */
    fbtrace_id?: string;
    error_data?: { details?: string };
  };
}

/** Outcome of a send, returned to callers instead of the raw Cloud API body. */
export interface WhatsAppSendResult {
  /** True when Meta accepted the message for delivery. */
  accepted: boolean;
  /** Meta's message id (`wamid.…`), used to correlate delivery webhooks later. */
  messageId?: string;
  /** WhatsApp's normalized contact id for the recipient, when returned. */
  waId?: string;
  /** Meta's queue status, when the API version reports one. */
  status?: string;
  /**
   * True when the message was only logged to the console because WhatsApp is not
   * configured (the local-development path — see WhatsAppService).
   */
  simulated: boolean;
}

/**
 * Why a send failed, in terms the caller can act on.
 *
 * - `configuration` — our credentials/template are wrong. Ops must fix it; retrying won't help.
 * - `recipient`     — this number can't receive the message (no WhatsApp, not allowlisted).
 * - `rate_limited`  — Meta is throttling us; the same request may succeed later.
 * - `transient`     — network/5xx. Already retried; may succeed later.
 * - `unknown`       — unmapped Meta error. Treated as non-retryable.
 */
export type WhatsAppFailureKind =
  | 'configuration'
  | 'recipient'
  | 'rate_limited'
  | 'transient'
  | 'unknown';
