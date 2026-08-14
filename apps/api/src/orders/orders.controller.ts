import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentStatus } from '@prime-kicks/types';
import type {
  CreateOrderSchema,
  OrderQuerySchema,
  UpdateOrderStatusSchema,
} from '@prime-kicks/validation';
import {
  createOrderSchema,
  orderQuerySchema,
  updateOrderStatusSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs the stale-PENDING auto-cancel sweep on demand. Meant to be called by an
   * external scheduler (server crontab / systemd timer) at 00:00 IST, so the job
   * no longer depends on the Node process being alive at the exact minute.
   *
   * Public (no JWT) but gated by the `x-cron-secret` header matching
   * INTERNAL_CRON_SECRET. Fails closed: if the secret env is unset, every call
   * is rejected.
   */
  @Public()
  @Post('internal/auto-cancel')
  async runAutoCancelSweep(@Headers('x-cron-secret') secret?: string) {
    const expected = this.config.get<string>('INTERNAL_CRON_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing cron secret.');
    }
    const cancelled = await this.orders.autoCancelStalePendingOrders('http');
    return { ok: true, cancelled };
  }

  /** Create an order — single endpoint for both web (customer) and admin (reseller) flows.
   *  When the body includes `resellerId`, the order is treated as admin-created.
   */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderSchema,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.create(user.id, body, user.role, user.email, idempotencyKey);
  }

  /** Get orders for the currently authenticated user (web profile). */
  @Get('my')
  findMy(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.findMyOrders(user.id, user.email);
  }

  /** List all orders (admin only). */
  @Roles('ADMIN')
  @Get()
  findAll(
    @Query(new ZodValidationPipe(orderQuerySchema)) query: OrderQuerySchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.findAll(query, user.email);
  }

  /** Outstanding receivables grouped by customer (admin only).
   *  Declared before `:id` so "payment-pending" isn't captured as an order id. */
  @Roles('ADMIN')
  @Get('payment-pending')
  paymentPending(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.paymentPendingSummary(user.email);
  }

  /** A single customer's approved-payment-pending orders (admin only). */
  @Roles('ADMIN')
  @Get('payment-pending/:userId')
  paymentPendingForUser(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.paymentPendingForUser(userId, user.email);
  }

  /** Get order details (admin only). */
  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.findOne(id, user.email);
  }

  /** Update order status (admin only). */
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.updateStatus(id, body, user.email);
  }

  /** Delete an order (admin only). */
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.remove(id, user.email);
  }

  /** Approve order and set payment status (admin only). */
  @Roles('ADMIN')
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: PaymentStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.approve(id, paymentStatus, user.email);
  }

  /** Reject order and restore stock (admin only). */
  @Roles('ADMIN')
  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.reject(id, user.email);
  }

  /** Undo an approved/rejected order back to PENDING (admin only). */
  @Roles('ADMIN')
  @Post(':id/undo')
  undo(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.undo(id, user.email);
  }

  /** Settle all approved-payment-pending orders for a customer (admin only). */
  @Roles('ADMIN')
  @Post('payment-pending/:userId/settle')
  settlePayment(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.settlePaymentForUser(userId, user.email);
  }
}
