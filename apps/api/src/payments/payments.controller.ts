import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  razorpayPaymentsQuerySchema,
  startRazorpayCheckoutSchema,
  verifyRazorpayPaymentSchema,
  type RazorpayPaymentsQuerySchema,
  type StartRazorpayCheckoutSchema,
  type VerifyRazorpayPaymentSchema,
} from '@prime-kicks/validation';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsService } from './payments.service';
import { RazorpayClientService } from './razorpay-client.service';

@Controller('payments/razorpay')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayClientService,
  ) {}

  /** Admin-only, read-only list of every Razorpay checkout attempt (web only). */
  @Roles('ADMIN')
  @Get()
  list(@Query(new ZodValidationPipe(razorpayPaymentsQuerySchema)) query: RazorpayPaymentsQuerySchema) {
    return this.payments.listPayments(query);
  }

  /**
   * Start a checkout session for a plain web customer's cart. No Order exists
   * yet — only once payment is confirmed (see /verify, /callback, /webhook).
   */
  @Post('order')
  startCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startRazorpayCheckoutSchema)) body: StartRazorpayCheckoutSchema,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.startWebCheckout(user.id, body, idempotencyKey);
  }

  /**
   * Confirm a Checkout success callback from the in-page handler. Always
   * resolves 200 with an `outcome` the frontend branches on — including
   * `refunded` (payment captured but the cart could no longer be fulfilled,
   * auto-refunded) — since every outcome here reflects a real, already-
   * verified payment, not a client error.
   */
  @Post('verify')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verifyRazorpayPaymentSchema)) body: VerifyRazorpayPaymentSchema,
  ) {
    return this.payments.verifyPayment(body, user.id);
  }

  /**
   * Razorpay's redirect-based callback (`callback_url` in Checkout options) —
   * used when a payment method forces the browser to leave our page entirely
   * (e.g. a bank's own 3-D Secure/OTP page), so the in-page success handler
   * never gets a chance to fire. Public: Razorpay form-POSTs here directly,
   * no JWT — the signature check inside `handleRedirectCallback` is what
   * authenticates the payload. Always ends in a redirect, never a JSON error,
   * since the caller is a real browser mid-navigation.
   */
  @Public()
  @Post('callback')
  async callback(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const redirectUrl = await this.payments.handleRedirectCallback(body);
    res.redirect(302, redirectUrl);
  }

  /**
   * Razorpay calls this directly — no JWT, authenticated instead by the HMAC
   * signature. Needs `rawBody: true` in main.ts so the HMAC covers the exact
   * bytes (already enabled for the WhatsApp webhook).
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    if (!req.rawBody || !signature) {
      throw new ForbiddenException('Missing signature.');
    }
    if (!this.razorpay.verifyWebhookSignature(req.rawBody, signature)) {
      throw new ForbiddenException('Invalid signature.');
    }
    // Past this point we never throw: a bad/unexpected event must not turn
    // into a Razorpay retry storm (same rule as the WhatsApp webhook).
    await this.payments.handleWebhookEvent(body as never);
    return { received: true };
  }
}
