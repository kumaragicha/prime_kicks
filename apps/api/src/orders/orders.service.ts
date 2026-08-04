import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEvent, AuditModule, Prisma, type UserRole } from '@prisma/client';
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
import { AuditLogService } from '../audit-log/audit-log.service';
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

/**
 * The relations every full-order response needs. Only `photoUrls` is read off
 * each item's product (title/sku/size are snapshotted onto the OrderItem), so
 * we deliberately avoid re-fetching product name/sku here.
 */
const orderDetailInclude = {
  user: { select: { id: true, name: true } },
  items: {
    include: { product: { select: { photoUrls: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Map an order's line items to the API DTO shape. */
function mapOrderItems(items: OrderWithDetails['items']) {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    title: item.title,
    sku: item.sku,
    sizeLabel: item.sizeLabel,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    product: { photoUrls: item.product.photoUrls },
  }));
}

/** Map an order's flattened shipping-address columns to the nested DTO shape. */
function mapOrderAddress(order: OrderWithDetails) {
  return {
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
  };
}

/** The full single-order DTO (used by create and findOne). */
function toOrderDto(order: OrderWithDetails) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    userName: order.user.name,
    status: order.status,
    paymentStatus: order.paymentStatus,
    orderType: order.orderType,
    shippingStatus: order.shippingStatus,
    items: mapOrderItems(order.items),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    currency: order.currency,
    address: mapOrderAddress(order),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Create an order.
   *  Single endpoint for both web (customer) and admin (reseller) flows.
   *  When `input.resellerId` is present the order is treated as admin-created:
   *  - the reseller's price is used instead of the customer price
   *  - the order is pre-approved (status follows paymentStatus)
   *  - the user's cart is NOT cleared
   */
  async create(
    userId: string,
    input: CreateOrderSchema,
    callerRole?: UserRole,
    auditedBy?: string,
  ) {
    // The admin-created flow (order billed to another user, pre-approved, reseller
    // pricing) is unlocked only by `resellerId` — and that must never be honored
    // for a non-admin caller, or any customer could place auto-approved,
    // reseller-priced orders on someone else's account.
    const isAdminCreated = Boolean(input.resellerId);
    if (isAdminCreated && callerRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create orders on behalf of another user');
    }

    // Admin-created orders use the reseller as the order owner; web orders use the authenticated user.
    const actualUserId = input.resellerId ?? userId;

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

    // Fetch every requested variant in a single query (avoids one round-trip per item).
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
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
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const itemsWithDetails: ItemWithDetails[] = input.items.map((item) => {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.productId !== item.productId) {
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
    });

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
      // Decrement stock atomically: the `stock >= quantity` guard means two
      // concurrent orders for the last unit can't both succeed (no overselling).
      // A zero-row update means it sold out between validation and commit.
      for (const item of itemsWithDetails) {
        const decremented = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (decremented.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for "${item.title}" size ${item.sizeLabel}. Please review your cart and try again.`,
          );
        }
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
        include: orderDetailInclude,
      });
    });

    const dto = toOrderDto(order);
    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.CREATION,
      moduleId: order.id,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} created${isAdminCreated ? ' (admin)' : ''}`,
      formData: { ...dto },
      auditedBy,
    });
    return dto;
  }

  /** Get orders for the currently authenticated user (web profile). */
  async findMyOrders(userId: string) {
    const data = await this.prisma.order.findMany({
      where: { userId },
      include: orderDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Same shape as the full order DTO minus the owner identity (the caller
    // already knows it's their own order).
    return data.map((order) => {
      const { userId: _userId, userName: _userName, ...rest } = toOrderDto(order);
      return rest;
    });
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
  async settlePaymentForUser(userId: string, auditedBy?: string) {
    const result = await this.prisma.order.updateMany({
      where: { userId, status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      data: {
        status: ORDER_STATUS.APPROVED_PAYMENT_RECEIVED,
        paymentStatus: PAYMENT_STATUS.RECEIVED,
      },
    });
    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.UPDATION,
      moduleId: userId,
      subModule: 'payment-settlement',
      action: `Settled ${result.count} pending payment order(s) for user ${userId}`,
      formData: { settled: result.count },
      auditedBy,
    });
    return { settled: result.count };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderDetailInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    return toOrderDto(order);
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
  async transition(id: string, target: OrderStatus, auditedBy?: string) {
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
        // Re-reserve the stock the rejection released — atomically, only if still
        // available. The transaction rolls back on the first shortfall.
        for (const item of order.items) {
          if (!item.variantId) continue;
          const decremented = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (decremented.count === 0) {
            throw new BadRequestException(
              `Insufficient stock to restore "${item.title}" (size ${item.sizeLabel}), needed: ${item.quantity}.`,
            );
          }
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

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.UPDATION,
      moduleId: order.id,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} status ${current} → ${target}`,
      formData: { from: current, to: target },
      auditedBy,
    });

    return this.findOne(id);
  }

  /** Manual status change from the admin UI — delegates to {@link transition}. */
  updateStatus(id: string, input: UpdateOrderStatusSchema, auditedBy?: string) {
    return this.transition(id, input.status as OrderStatus, auditedBy);
  }

  async remove(id: string, auditedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: { select: { variantId: true, quantity: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    // A non-rejected order still holds its reserved stock; deleting it must
    // return those units to inventory (a REJECTED order already released them).
    const releaseStock = order.status !== ORDER_STATUS.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      if (releaseStock) {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      await tx.order.delete({ where: { id } });
    });

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.DELETION,
      moduleId: order.id,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} deleted`,
      formData: { status: order.status, stockReleased: releaseStock },
      auditedBy,
    });

    return { id, deleted: true };
  }

  /** Approve an order; payment RECEIVED → complete, PENDING → dispatched on credit. */
  approve(id: string, paymentStatus: PaymentStatus, auditedBy?: string) {
    return this.transition(
      id,
      paymentStatus === PAYMENT_STATUS.RECEIVED
        ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
        : ORDER_STATUS.APPROVED_PAYMENT_PENDING,
      auditedBy,
    );
  }

  /** Revert an order back to PENDING (re-reserving stock if it was rejected). */
  undo(id: string, auditedBy?: string) {
    return this.transition(id, ORDER_STATUS.PENDING, auditedBy);
  }

  /** Reject an order and restore its stock to inventory. */
  reject(id: string, auditedBy?: string) {
    return this.transition(id, ORDER_STATUS.REJECTED, auditedBy);
  }
}
