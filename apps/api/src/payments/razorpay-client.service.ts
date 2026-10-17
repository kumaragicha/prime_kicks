import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

/** Compare two strings without leaking where they differ through timing. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Thin wrapper around the Razorpay SDK. The client is created lazily (not at
 * module load) so a missing key pair only breaks payment requests, never app
 * boot — the same pattern as MailService for a missing SMTP config.
 */
@Injectable()
export class RazorpayClientService {
  private client: Razorpay | null = null;

  constructor(private readonly config: ConfigService) {}

  /** The publishable key id — safe to hand to the browser (Checkout needs it). */
  get keyId(): string {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    if (!keyId) {
      throw new ServiceUnavailableException('Razorpay is not configured (RAZORPAY_KEY_ID unset).');
    }
    return keyId;
  }

  private get keySecret(): string {
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured (RAZORPAY_KEY_SECRET unset).',
      );
    }
    return keySecret;
  }

  get instance(): Razorpay {
    if (!this.client) {
      this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    }
    return this.client;
  }

  /**
   * HMAC-verifies a Checkout success callback. Razorpay's documented formula:
   * signature = HMAC_SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, key_secret).
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqual(signature, expected);
  }

  /** HMAC-verifies a webhook delivery against the exact raw request body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Razorpay webhook is not configured (RAZORPAY_WEBHOOK_SECRET unset).',
      );
    }
    return Razorpay.validateWebhookSignature(rawBody.toString(), signature, webhookSecret);
  }

  /**
   * Full refund for a payment we captured but can't fulfil (e.g. an item sold
   * out between checkout start and payment confirmation). Returns the
   * Razorpay refund id for the audit trail.
   */
  async refundPayment(paymentId: string, amount: number, reason: string): Promise<string> {
    const refund = await this.instance.payments.refund(paymentId, {
      amount,
      speed: 'normal',
      notes: { reason },
    });
    return refund.id;
  }
}
