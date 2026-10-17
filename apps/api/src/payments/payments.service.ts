import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RAZORPAY_PAYMENT_STATUS, type AdminRazorpayPaymentRow } from '@prime-kicks/types';
import type {
  OrderAddressSchema,
  RazorpayPaymentsQuerySchema,
  StartRazorpayCheckoutSchema,
  VerifyRazorpayPaymentSchema,
} from '@prime-kicks/validation';
import { Prisma } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayClientService } from './razorpay-client.service';

/** True when `error` is a Prisma unique-constraint violation on `field`. */
function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = Array.isArray(error.meta?.target)
    ? (error.meta?.target as string[]).join(',')
    : String(error.meta?.target ?? '');
  return target.includes(field);
}

/** Only the fields a payment.captured / payment.failed webhook payload needs. */
interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
}

/** Outcome of confirming a checkout session's payment — the caller (verify /
 *  callback / webhook) decides what to do with it (redirect, JSON response, …). */
type ConfirmResult =
  | { outcome: 'confirmed'; orderNumber: string }
  | { outcome: 'already_confirmed'; orderNumber: string }
  | { outcome: 'refunded' }
  | { outcome: 'invalid' };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClientService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Start a Razorpay checkout session for a plain web customer's cart. NO
   * Order is created here — only once payment is confirmed (see
   * confirmPayment below). An abandoned/failed checkout therefore leaves no
   * order, no stock touched, and the cart untouched.
   *
   * Idempotent: a retried "Place order" click (same Idempotency-Key) reuses
   * the existing session/Razorpay order instead of opening a duplicate.
   */
  async startWebCheckout(
    userId: string,
    input: StartRazorpayCheckoutSchema,
    idempotencyKey?: string,
  ) {
    const idemKey = idempotencyKey?.trim() || undefined;

    // Idempotency fast path: a retried "Place order" click (same key) reuses
    // the existing session's Razorpay order instead of opening a duplicate.
    // Only a PENDING session for the SAME user qualifies — anything else
    // (already confirmed/refunded, or a different user's key) falls through
    // to opening a fresh session instead of reusing stale/foreign state.
    if (idemKey) {
      const existing = await this.prisma.razorpayCheckoutSession.findUnique({
        where: { idempotencyKey: idemKey },
      });
      if (
        existing &&
        existing.userId === userId &&
        existing.status === RAZORPAY_PAYMENT_STATUS.PENDING
      ) {
        this.logger.debug(`Checkout idempotency hit for key ${idemKey} — reusing session ${existing.id}`);
        return {
          keyId: this.razorpay.keyId,
          razorpayOrderId: existing.razorpayOrderId,
          amount: existing.amount,
          currency: existing.currency,
        };
      }
    }

    // Re-price + validate live (stock sufficiency is a courtesy check here —
    // the authoritative, race-safe check happens atomically inside
    // OrdersService.create() at confirmation time).
    const priced = await this.orders.priceCustomerCheckout(userId, {
      items: input.items,
      isPickup: input.isPickup,
      address: input.address,
    });
    const amount = priced.total * 100; // Razorpay wants paise; `total` is whole rupees

    const razorpayOrder = await this.razorpay.instance.orders.create({
      amount,
      currency: 'INR',
      // Receipt is for Razorpay-dashboard reference only — no Order exists yet.
      receipt: `checkout_${Date.now()}`,
    });

    try {
      await this.prisma.razorpayCheckoutSession.create({
        data: {
          userId,
          razorpayOrderId: razorpayOrder.id,
          idempotencyKey: idemKey ?? null,
          itemsJson: input.items,
          addressJson: input.address ?? undefined,
          isPickup: input.isPickup ?? false,
          amount,
          currency: 'INR',
          status: RAZORPAY_PAYMENT_STATUS.PENDING,
        },
      });
    } catch (error) {
      // Lost an idempotency race: a concurrent request with the same key
      // already created a session — return that one. (The Razorpay order we
      // just created above is harmlessly orphaned on Razorpay's dashboard;
      // never charged against since we never hand its id to the browser.)
      if (idemKey && isUniqueConstraintViolation(error, 'idempotencyKey')) {
        const winner = await this.prisma.razorpayCheckoutSession.findUnique({
          where: { idempotencyKey: idemKey },
        });
        if (winner) {
          this.logger.debug(`Checkout idempotency race resolved to session ${winner.id}`);
          return {
            keyId: this.razorpay.keyId,
            razorpayOrderId: winner.razorpayOrderId,
            amount: winner.amount,
            currency: winner.currency,
          };
        }
      }
      throw error;
    }

    this.logger.log(`Checkout session opened — Razorpay order ${razorpayOrder.id} for user ${userId}`);
    return { keyId: this.razorpay.keyId, razorpayOrderId: razorpayOrder.id, amount, currency: 'INR' };
  }

  /** Confirm a Checkout success callback from the storefront (in-page handler). */
  async verifyPayment(input: VerifyRazorpayPaymentSchema, userId: string): Promise<ConfirmResult> {
    const session = await this.prisma.razorpayCheckoutSession.findUnique({
      where: { razorpayOrderId: input.razorpay_order_id },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Checkout session not found');
    }

    const valid = this.razorpay.verifyPaymentSignature(
      input.razorpay_order_id,
      input.razorpay_payment_id,
      input.razorpay_signature,
    );
    if (!valid) {
      this.logger.warn(`Signature verification FAILED for session ${session.id}`);
      throw new BadRequestException('Payment verification failed.');
    }

    return this.confirmPayment(session.id, input.razorpay_payment_id);
  }

  /**
   * Razorpay's redirect-based callback (`callback_url` in Checkout options).
   * Some payment methods (e.g. a bank's own 3-D Secure/OTP page) force a full
   * top-level navigation away from our page — the in-page handler never gets
   * a chance to fire there. Razorpay form-POSTs the result here instead, on a
   * real browser mid-navigation — so this never throws, it always resolves
   * to a redirect target.
   */
  async handleRedirectCallback(body: Record<string, unknown>): Promise<string> {
    const webAppUrl = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : undefined;
    const razorpayOrderId =
      typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : undefined;
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : undefined;

    // Razorpay POSTs a different shape on a failed/cancelled payment:
    // error[code], error[description], error[metadata][order_id], etc.
    if (!paymentId || !razorpayOrderId || !signature) {
      this.logger.warn('Razorpay redirect callback without a successful payment');
      return `${webAppUrl}/orders?payment=failed`;
    }

    const session = await this.prisma.razorpayCheckoutSession.findUnique({
      where: { razorpayOrderId },
    });
    if (!session) {
      this.logger.warn(`Redirect callback for unknown Razorpay order ${razorpayOrderId}`);
      return `${webAppUrl}/orders?payment=failed`;
    }

    const valid = this.razorpay.verifyPaymentSignature(razorpayOrderId, paymentId, signature);
    if (!valid) {
      this.logger.warn(`Redirect callback signature verification FAILED for session ${session.id}`);
      return `${webAppUrl}/orders?payment=failed`;
    }

    const result = await this.confirmPayment(session.id, paymentId);
    if (result.outcome === 'confirmed' || result.outcome === 'already_confirmed') {
      return `${webAppUrl}/order-confirmed?order=${encodeURIComponent(result.orderNumber)}`;
    }
    if (result.outcome === 'refunded') {
      return `${webAppUrl}/orders?payment=refunded`;
    }
    return `${webAppUrl}/orders?payment=failed`;
  }

  /**
   * Server-to-server safety net: confirms payment even if the browser closes
   * before the in-page handler or the redirect callback fire. Never throws
   * past the signature check — Razorpay retries a non-200 for hours, and a
   * bad event must not turn into a retry storm.
   */
  async handleWebhookEvent(payload: RazorpayWebhookPayload): Promise<void> {
    if (payload.event !== 'payment.captured') return; // payment.failed etc. — nothing to do
    const payment = payload.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) return;

    const session = await this.prisma.razorpayCheckoutSession.findUnique({
      where: { razorpayOrderId: payment.order_id },
    });
    if (!session) {
      this.logger.warn(`Webhook payment.captured for unknown Razorpay order ${payment.order_id}`);
      return;
    }

    await this.confirmPayment(session.id, payment.id);
  }

  /**
   * The single confirmation path shared by /verify, the redirect callback,
   * and the webhook — whichever fires first wins, the others are harmless
   * no-ops. Re-validates stock + price fresh (via OrdersService.create(),
   * which decrements stock atomically) and creates the Order ONLY now, never
   * before. If the cart can no longer be fulfilled (an item sold out in the
   * meantime), the payment is automatically refunded in full and no Order is
   * created — the customer is never charged for something we can't deliver.
   */
  private async confirmPayment(sessionId: string, paymentId: string): Promise<ConfirmResult> {
    // Atomically claim the session: only one caller (of verify/callback/
    // webhook, however many fire concurrently) transitions PENDING →
    // CONSUMING; the rest see count=0 and fall through to the "already
    // being/been handled" branch below instead of racing to create an order.
    const claimed = await this.prisma.razorpayCheckoutSession.updateMany({
      where: { id: sessionId, status: RAZORPAY_PAYMENT_STATUS.PENDING },
      data: { status: RAZORPAY_PAYMENT_STATUS.CONSUMING, razorpayPaymentId: paymentId },
    });

    if (claimed.count === 0) {
      // Someone else already claimed it — verify/callback/webhook can all
      // fire within milliseconds of each other. Poll briefly for the winner
      // to finish instead of reporting failure to a caller that "lost" a race
      // the payment itself didn't lose (the loser must not tell the customer
      // their successful payment failed).
      for (let attempt = 0; attempt < 10; attempt++) {
        const session = await this.prisma.razorpayCheckoutSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) return { outcome: 'invalid' };
        if (session.status === RAZORPAY_PAYMENT_STATUS.CONSUMED && session.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: session.orderId },
            select: { orderNumber: true },
          });
          if (order) return { outcome: 'already_confirmed', orderNumber: order.orderNumber };
        }
        if (session.status === RAZORPAY_PAYMENT_STATUS.REFUNDED) return { outcome: 'refunded' };
        if (session.status !== RAZORPAY_PAYMENT_STATUS.CONSUMING) break; // unexpected state — stop polling, fall through
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      // Still unresolved after ~3s — the winner's order-creation attempt is
      // taking unusually long or crashed. Report transient failure; the
      // webhook (if this wasn't it) retries on its own schedule regardless.
      this.logger.warn(`Session ${sessionId} still CONSUMING after polling — reporting transient failure`);
      return { outcome: 'invalid' };
    }

    const session = await this.prisma.razorpayCheckoutSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const items = session.itemsJson as unknown as Array<{
      productId: string;
      variantId: string;
      quantity: number;
    }>;
    const address = session.addressJson as unknown as OrderAddressSchema | undefined;

    try {
      const order = await this.orders.create(
        session.userId,
        {
          items,
          isPickup: session.isPickup,
          address,
          // Plain web customer order — same defaults createOrderSchema itself
          // would apply; admin-only fields are never set for this flow.
          orderType: 'SINGLE',
          paymentStatus: 'PENDING',
          shippingStatus: 'PENDING',
          shipping: 0,
        },
        undefined,
        'razorpay-confirm',
        // Reuses the Order model's own idempotency-key fast path: if this
        // session is somehow confirmed twice (e.g. the atomic claim above
        // raced with a process restart mid-transaction), the SAME order is
        // returned instead of a duplicate being created.
        session.razorpayOrderId,
        true, // prePaid
      );

      await this.prisma.razorpayCheckoutSession.update({
        where: { id: session.id },
        data: { status: RAZORPAY_PAYMENT_STATUS.CONSUMED, orderId: order.id },
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: session.razorpayOrderId, razorpayPaymentId: paymentId },
      });

      this.logger.log(`Payment confirmed — order ${order.orderNumber} created for session ${session.id}`);
      return { outcome: 'confirmed', orderNumber: order.orderNumber };
    } catch (error) {
      // The cart could no longer be fulfilled (most commonly: an item sold
      // out between checkout start and payment confirmation). We already
      // took the customer's money — never keep it for something we can't
      // deliver: refund in full and leave no Order behind.
      const reason = error instanceof Error ? error.message : 'Unable to fulfil the order';
      this.logger.error(`Order creation FAILED for paid session ${session.id}: ${reason} — refunding`);
      try {
        const refundId = await this.razorpay.refundPayment(paymentId, session.amount, reason);
        await this.prisma.razorpayCheckoutSession.update({
          where: { id: session.id },
          data: {
            status: RAZORPAY_PAYMENT_STATUS.REFUNDED,
            refundId,
            refundedAt: new Date(),
            refundReason: reason,
          },
        });
        this.logger.log(`Refund ${refundId} issued for session ${session.id} (${reason})`);
        return { outcome: 'refunded' };
      } catch (refundError) {
        // Refund itself failed — this needs a human. Leave the session
        // CONSUMING (neither PENDING nor resolved) so it's visibly stuck in
        // the admin table rather than silently lost, and surface loudly.
        const refundReason = refundError instanceof Error ? refundError.message : String(refundError);
        this.logger.error(
          `REFUND FAILED for session ${session.id}, payment ${paymentId}: ${refundReason}. ` +
            `Manual refund required — customer was charged but no order was created.`,
        );
        return { outcome: 'invalid' };
      }
    }
  }

  /**
   * Admin-only, read-only list of every Razorpay checkout attempt — pending,
   * confirmed, refunded, or failed. Web storefront only: reseller/credit
   * orders never create a session.
   */
  async listPayments(
    query: RazorpayPaymentsQuerySchema,
  ): Promise<{ data: AdminRazorpayPaymentRow[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const { page, pageSize } = query;

    const [sessions, total] = await Promise.all([
      this.prisma.razorpayCheckoutSession.findMany({
        select: {
          id: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          status: true,
          refundReason: true,
          amount: true,
          currency: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.razorpayCheckoutSession.count(),
    ]);

    return {
      data: sessions.map((s) => ({
        id: s.id,
        orderNumber: s.order?.orderNumber ?? null,
        razorpayOrderId: s.razorpayOrderId,
        razorpayPaymentId: s.razorpayPaymentId,
        status: s.status as AdminRazorpayPaymentRow['status'],
        refundReason: s.refundReason,
        amount: s.amount,
        currency: s.currency,
        createdAt: s.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }
}
