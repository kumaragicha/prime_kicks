import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Create an order — single endpoint for both web (customer) and admin (reseller) flows.
   *  When the body includes `resellerId`, the order is treated as admin-created.
   */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderSchema,
  ) {
    return this.orders.create(user.id, body);
  }

  /** Get orders for the currently authenticated user (web profile). */
  @Get('my')
  findMy(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.findMyOrders(user.id);
  }

  /** List all orders (admin only). */
  @Roles('ADMIN')
  @Get()
  findAll(@Query(new ZodValidationPipe(orderQuerySchema)) query: OrderQuerySchema) {
    return this.orders.findAll(query);
  }

  /** Outstanding receivables grouped by customer (admin only).
   *  Declared before `:id` so "payment-pending" isn't captured as an order id. */
  @Roles('ADMIN')
  @Get('payment-pending')
  paymentPending() {
    return this.orders.paymentPendingSummary();
  }

  /** A single customer's approved-payment-pending orders (admin only). */
  @Roles('ADMIN')
  @Get('payment-pending/:userId')
  paymentPendingForUser(@Param('userId') userId: string) {
    return this.orders.paymentPendingForUser(userId);
  }

  /** Get order details (admin only). */
  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  /** Update order status (admin only). */
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusSchema,
  ) {
    return this.orders.updateStatus(id, body);
  }

  /** Delete an order (admin only). */
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orders.remove(id);
  }

  /** Approve order and set payment status (admin only). */
  @Roles('ADMIN')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body('paymentStatus') paymentStatus: PaymentStatus) {
    return this.orders.approve(id, paymentStatus);
  }

  /** Reject order and restore stock (admin only). */
  @Roles('ADMIN')
  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.orders.reject(id);
  }

  /** Undo an approved/rejected order back to PENDING (admin only). */
  @Roles('ADMIN')
  @Post(':id/undo')
  undo(@Param('id') id: string) {
    return this.orders.undo(id);
  }

  /** Settle all approved-payment-pending orders for a customer (admin only). */
  @Roles('ADMIN')
  @Post('payment-pending/:userId/settle')
  settlePayment(@Param('userId') userId: string) {
    return this.orders.settlePaymentForUser(userId);
  }
}
