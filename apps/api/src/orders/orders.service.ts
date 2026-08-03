import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_STATUS,
  type OrderStatus,
  type PaymentStatus,
} from '@prime-kicks/types';
import type {
  CreateOrderSchema,
  OrderQuerySchema,
  UpdateOrderStatusSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Payment status implied by each order status. Payment is only ever RECEIVED
 * once an order is approved-with-payment; every other status is PENDING. Keeping
 * this derived (rather than set independently) is what makes the four statuses a
 * clean, consistent state machine.
 */
const PAYMENT_FOR_STATUS: Record<OrderStatus, PaymentStatus> = {
  [ORDER_STATUS.PENDING]: PAYMENT_STATUS.PENDING,
  [ORDER_STATUS.APPROVED_PAYMENT_RECEIVED]: PAYMENT_STATUS.RECEIVED,
  [ORDER_STATUS.APPROVED_PAYMENT_PENDING]: PAYMENT_STATUS.PENDING,
  [ORDER_STATUS.REJECTED]: PAYMENT_STATUS.PENDING,
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create an order.
   *  Single endpoint for both web (customer) and admin (reseller) flows.
   *  When `input.resellerId` is present the order is treated as admin-created:
   *  - the reseller's price is used instead of the customer price
   *  - the order is pre-approved (status follows paymentStatus)
   *  - the user's cart is NOT cleared
   */
  async create(userId: string, input: CreateOrderSchema) {
    // Admin-created orders use the reseller as the order owner; web orders use the authenticated user.
    const actualUserId = input.resellerId ?? userId;
    const isAdminCreated = Boolean(input.resellerId);

    // Validate user exists and is active (disabled users cannot place orders)
    const user = await this.prisma.user.findFirst({
      where: { id: actualUserId, deletedAt: null },
      select: { id: true, name: true, isActive: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) {
      throw new BadRequestException('Your account is disabled. You cannot place orders.');
    }

    // Validate all items and compute pricing
    type ItemWithDetails = {
      productId: string;
      variantId: string;
      title: string;
      sku: string;
      sizeLabel: string;
      unitPrice: number;
      quantity: number;
    };

    // Web orders from RESELLER accounts use the reseller price; everyone else pays the customer price.
    const useResellerPrice = isAdminCreated || user.role === 'RESELLER';

    const itemsWithDetails: ItemWithDetails[] = await Promise.all(
      input.items.map(async (item) => {
        const variant = await this.prisma.productVariant.findFirst({
          where: { id: item.variantId, productId: item.productId },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                customerPrice: true,
                resellerPrice: true,
                photoUrls: true,
              },
            },
            size: { select: { label: true } },
          },
        });

        if (!variant) {
          throw new NotFoundException(
            `Variant ${item.variantId} not found for product ${item.productId}`,
          );
        }

        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${variant.product.name}" size ${variant.size.label}. Available: ${variant.stock}, requested: ${item.quantity}`,
          );
        }

        return {
          productId: variant.product.id,
          variantId: variant.id,
          title: variant.product.name,
          sku: variant.product.sku,
          sizeLabel: variant.size.label,
          unitPrice: useResellerPrice
            ? variant.product.resellerPrice
            : variant.product.customerPrice,
          quantity: item.quantity,
        };
      }),
    );

    // Compute totals
    const subtotal = itemsWithDetails.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const shipping = input.shipping ?? 0;
    const total = subtotal + shipping;

    // Admin-created orders are pre-approved; web orders start as PENDING.
    const status = isAdminCreated
      ? input.paymentStatus === PAYMENT_STATUS.RECEIVED
        ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
        : ORDER_STATUS.APPROVED_PAYMENT_PENDING
      : ORDER_STATUS.PENDING;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const addr = input.address;

    // Create order in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Decrement stock
      for (const item of itemsWithDetails) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Clear cart items for this user (web flow only — admin-created orders don't touch the cart)
      if (!isAdminCreated) {
        const cart = await tx.cart.findUnique({
          where: { userId: actualUserId },
          select: { id: true },
        });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: actualUserId,
          status,
          paymentStatus: input.paymentStatus ?? PAYMENT_STATUS.PENDING,
          orderType: input.orderType ?? ORDER_TYPE.SINGLE,
          shippingStatus: input.shippingStatus ?? PAYMENT_STATUS.PENDING,
          subtotal,
          shipping,
          total,
          addressName: addr.name,
          addressEmail: addr.email || null,
          addressMobileNo: addr.mobileNo,
          addressAltMobileNo: addr.altMobileNo || null,
          addressLine1: addr.line1,
          addressLine2: addr.line2 ?? '',
          landmark: addr.landmark ?? '',
          pincode: addr.pincode,
          city: addr.city,
          state: addr.state,
          items: {
            create: itemsWithDetails.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              title: item.title,
              sku: item.sku,
              sizeLabel: item.sizeLabel,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true, photoUrls: true } } },
            orderBy: { id: 'asc' },
          },
        },
      });
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userName: order.user.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderType: order.orderType,
      shippingStatus: order.shippingStatus,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: {
          photoUrls: item.product.photoUrls,
        },
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      address: {
        name: order.addressName,
        email: order.addressEmail,
        altMobileNo: order.addressAltMobileNo,
        mobileNo: order.addressMobileNo,
        line1: order.addressLine1,
        line2: order.addressLine2,
        landmark: order.landmark,
        pincode: order.pincode,
        city: order.city,
        state: order.state,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  /** Get orders for the currently authenticated user (web profile). */
  async findMyOrders(userId: string) {
    const data = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, photoUrls: true } } },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return data.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderType: order.orderType,
      shippingStatus: order.shippingStatus,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: {
          photoUrls: item.product.photoUrls,
        },
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      address: {
        name: order.addressName,
        email: order.addressEmail,
        altMobileNo: order.addressAltMobileNo,
        mobileNo: order.addressMobileNo,
        line1: order.addressLine1,
        line2: order.addressLine2,
        landmark: order.landmark,
        pincode: order.pincode,
        city: order.city,
        state: order.state,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }));
  }

  async findAll(query: OrderQuerySchema) {
    const { page, pageSize, search, status, sort } = query;

    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (search) {
      where['OR'] = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          items: { select: { id: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: data.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        userName: order.user.name,
        status: order.status,
        itemsCount: order.items.length,
        total: order.total,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Outstanding receivables grouped by customer: one entry per user who has
   * approved-but-unpaid orders (APPROVED_PAYMENT_PENDING), with their pending
   * order count and total owed. Highest balance first.
   */
  async paymentPendingSummary() {
    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      _sum: { total: true },
      _count: { _all: true },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return grouped
      .map((g) => ({
        userId: g.userId,
        userName: nameById.get(g.userId) ?? 'Unknown',
        orderCount: g._count._all,
        totalPending: g._sum.total ?? 0,
      }))
      .sort((a, b) => b.totalPending - a.totalPending);
  }

  /** The approved-payment-pending orders for one user (the card's detail view). */
  async paymentPendingForUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const orders = await this.prisma.order.findMany({
      where: { userId, status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      include: { items: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId: user.id,
      userName: user.name,
      totalPending: orders.reduce((sum, o) => sum + o.total, 0),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        itemsCount: o.items.length,
        total: o.total,
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Settle every approved-payment-pending order for a user in one shot — marks
   * them APPROVED_PAYMENT_RECEIVED. No stock change (already approved, so stock
   * stays reserved either way), so a single bulk update is safe.
   */
  async settlePaymentForUser(userId: string) {
    const result = await this.prisma.order.updateMany({
      where: { userId, status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      data: {
        status: ORDER_STATUS.APPROVED_PAYMENT_RECEIVED,
        paymentStatus: PAYMENT_STATUS.RECEIVED,
      },
    });
    return { settled: result.count };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, photoUrls: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userName: order.user.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderType: order.orderType,
      shippingStatus: order.shippingStatus,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: {
          photoUrls: item.product.photoUrls,
        },
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      address: {
        name: order.addressName,
        email: order.addressEmail,
        altMobileNo: order.addressAltMobileNo,
        mobileNo: order.addressMobileNo,
        line1: order.addressLine1,
        line2: order.addressLine2,
        landmark: order.landmark,
        pincode: order.pincode,
        city: order.city,
        state: order.state,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  /**
   * The single choke point for every order status change (manual update,
   * approve, reject, undo). Admins can move an order to ANY status, back and
   * forth; this method keeps the side effects consistent:
   *
   *  - Stock: every non-REJECTED status holds the order's reserved stock;
   *    REJECTED releases it. So stock only moves when crossing the REJECTED
   *    boundary — leaving REJECTED re-reserves it (validating availability),
   *    entering REJECTED restores it to inventory.
   *  - Payment: derived from the target status via {@link PAYMENT_FOR_STATUS}.
   *
   * Transitioning to the current status is a no-op (idempotent).
   */
  async transition(id: string, target: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { variant: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const current = order.status as OrderStatus;
    if (current === target) return this.findOne(id);

    const leavingRejected = current === ORDER_STATUS.REJECTED;
    const enteringRejected = target === ORDER_STATUS.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      if (leavingRejected) {
        // Re-reserve the stock the rejection released — only if still available.
        for (const item of order.items) {
          if (!item.variantId) continue;
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true },
          });
          if (!variant || variant.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock to restore "${item.title}" (size ${item.sizeLabel}). ` +
                `Available: ${variant?.stock ?? 0}, needed: ${item.quantity}.`,
            );
          }
        }
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      } else if (enteringRejected) {
        // Release the reserved stock back to inventory.
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      await tx.order.update({
        where: { id },
        data: { status: target, paymentStatus: PAYMENT_FOR_STATUS[target] },
      });
    });

    return this.findOne(id);
  }

  /** Manual status change from the admin UI — delegates to {@link transition}. */
  updateStatus(id: string, input: UpdateOrderStatusSchema) {
    return this.transition(id, input.status as OrderStatus);
  }

  async remove(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    await this.prisma.order.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Approve an order; payment RECEIVED → complete, PENDING → dispatched on credit. */
  approve(id: string, paymentStatus: PaymentStatus) {
    return this.transition(
      id,
      paymentStatus === PAYMENT_STATUS.RECEIVED
        ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
        : ORDER_STATUS.APPROVED_PAYMENT_PENDING,
    );
  }

  /** Revert an order back to PENDING (re-reserving stock if it was rejected). */
  undo(id: string) {
    return this.transition(id, ORDER_STATUS.PENDING);
  }

  /** Reject an order and restore its stock to inventory. */
  reject(id: string) {
    return this.transition(id, ORDER_STATUS.REJECTED);
  }
}
