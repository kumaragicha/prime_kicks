import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { AuditEvent, AuditModule, Prisma, type UserRole } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { buildCreatedAtRange } from '../common/date-range.util';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ShipmentService } from '../shipmozo/shipment.service';

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
  creditCustomer: { select: { id: true, name: true } },
  items: {
    include: { product: { select: { photoUrls: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderInclude;

/** An order's owner is either a login User or a CreditCustomer — return the display name. */
function ownerName(order: {
  user: { name: string } | null;
  creditCustomer: { name: string } | null;
}): string {
  return order.user?.name ?? order.creditCustomer?.name ?? 'Unknown';
}

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Human-readable, collision-resistant order number: time + random suffix.
 *  A P2002 on the unique column triggers a regenerate-and-retry in create(). */
function generateOrderNumber(): string {
  const random = Math.random().toString(36).slice(2, 9).toUpperCase();
  return `ORD-${Date.now()}-${random}`;
}

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

/** Map an order's flattened shipping-address columns to the nested DTO shape.
 *  Pickup orders have no shipping address — return null. */
function mapOrderAddress(order: OrderWithDetails) {
  if (order.isPickup) return null;
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

/**
 * Map an order's Shipmozo shipment columns to the DTO shape.
 * `includeInternal` controls the admin-only fields (Shipmozo ids + last error);
 * customers only ever see the courier, tracking id and status.
 */
function mapShipment(order: OrderWithDetails, includeInternal: boolean) {
  return {
    status: order.shipmentStatus,
    courierPartner: order.courierPartner,
    trackingId: order.trackingId,
    pushedAt: order.shipmentPushedAt?.toISOString() ?? null,
    ...(includeInternal
      ? {
          shipmozoOrderId: order.shipmozoOrderId,
          shipmozoReferenceId: order.shipmozoReferenceId,
          error: order.shipmentError,
        }
      : {}),
  };
}

/** The full single-order DTO (used by create and findOne). */
function toOrderDto(order: OrderWithDetails) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    userName: ownerName(order),
    status: order.status,
    paymentStatus: order.paymentStatus,
    orderType: order.orderType,
    shippingStatus: order.shippingStatus,
    items: mapOrderItems(order.items),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    currency: order.currency,
    isPickup: order.isPickup,
    address: mapOrderAddress(order),
    shipment: mapShipment(order, true),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly shipment: ShipmentService,
    private readonly settings: SettingsService,
  ) {}

  /** Guards against overlapping auto-cancel sweeps if one runs long. */
  private autoCancelling = false;

  /** How long an unpaid web order may sit PENDING before it's auto-cancelled. */
  private static readonly PENDING_ORDER_TTL_MS = 48 * 60 * 60 * 1000;

  /**
   * Auto-cancel unpaid web orders. A customer who checks out on the web places
   * a PENDING order (payment is confirmed manually by an admin); if payment
   * never arrives, the order shouldn't hold its reserved stock forever. This
   * runs every night at 12:00 AM (IST) and cancels orders that have been PENDING
   * for more than 48 hours, which restores their inventory. Only PENDING is
   * swept — admin-created orders are pre-approved (never PENDING), so this only
   * ever touches web/customer orders.
   *
   * Cancelling reuses {@link transition} → REJECTED, so it releases stock and
   * syncs the Shipmozo cancel exactly like a manual admin rejection.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Kolkata' })
  async autoCancelStalePendingOrders(trigger = 'cron'): Promise<number> {
    if (this.autoCancelling) {
      this.logger.warn(`Auto-cancel sweep (${trigger}) skipped — a previous run is still active.`);
      return 0;
    }
    this.autoCancelling = true;
    let cancelled = 0;
    try {
      const cutoff = new Date(Date.now() - OrdersService.PENDING_ORDER_TTL_MS);
      const stale = await this.prisma.order.findMany({
        where: { status: ORDER_STATUS.PENDING, createdAt: { lt: cutoff } },
        select: { id: true, orderNumber: true },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      for (const order of stale) {
        try {
          // Re-check just before acting: an admin may have approved it since the
          // sweep query, in which case we must not cancel a now-approved order.
          const fresh = await this.prisma.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          });
          if (fresh?.status !== ORDER_STATUS.PENDING) continue;
          await this.transition(order.id, ORDER_STATUS.REJECTED, 'system:auto-cancel');
          cancelled += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Auto-cancel failed for ${order.orderNumber}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Auto-cancel sweep (${trigger}) failed: ${message}`);
    } finally {
      this.autoCancelling = false;
    }
    // Heartbeat: always logged (even on a quiet night) so the run is verifiable.
    this.logger.log(`Auto-cancel sweep (${trigger}) finished — ${cancelled} order(s) cancelled.`);
    return cancelled;
  }

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
    idempotencyKey?: string,
  ) {
    this.logger.debug(
      `[ORDER DEBUG] create START userId=${userId} callerRole=${callerRole ?? 'none'} resellerId=${input.resellerId ?? 'none'} items=${input.items.length} idem=${idempotencyKey ?? 'none'}`,
    );

    // Idempotency fast path: a retried checkout (same Idempotency-Key) returns the
    // original order instead of creating a duplicate + double-decrementing stock.
    // A concurrent race that slips past this is still caught by the unique index
    // on commit (see the P2002 handling below).
    const idemKey = idempotencyKey?.trim() || undefined;
    if (idemKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: idemKey },
        include: orderDetailInclude,
      });
      if (existing) {
        this.logger.debug(
          `[ORDER DEBUG] idempotency hit — returning existing order ${existing.orderNumber} for key ${idemKey}`,
        );
        return toOrderDto(existing);
      }
    }
    // The admin-created flow (order billed to another account, pre-approved) is
    // unlocked by either `resellerId` (reseller pricing) or `creditCustomerId`
    // (bulk, manual per-line rate). Neither may be honored for a non-admin caller,
    // or any customer could place auto-approved orders on someone else's account.
    const isResellerOrder = Boolean(input.resellerId);
    const isCreditOrder = Boolean(input.creditCustomerId);
    const isAdminCreated = isResellerOrder || isCreditOrder;
    if (isAdminCreated && callerRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create orders on behalf of another account');
    }

    // Resolve the order owner: a CreditCustomer (bulk) OR a login User
    // (reseller / web). Exactly one of these ends up set on the order.
    let ownerUserId: string | null = null;
    let ownerCreditCustomerId: string | null = null;
    let ownerRole: UserRole | null = null;

    if (isCreditOrder) {
      const creditCustomer = await this.prisma.creditCustomer.findFirst({
        where: { id: input.creditCustomerId!, deletedAt: null },
        select: { id: true },
      });
      if (!creditCustomer) throw new NotFoundException('Credit customer not found');
      ownerCreditCustomerId = creditCustomer.id;
    } else {
      // Admin reseller orders bill the reseller; web orders bill the caller.
      const actualUserId = input.resellerId ?? userId;
      const user = await this.prisma.user.findFirst({
        where: { id: actualUserId, deletedAt: null },
        select: { id: true, name: true, isActive: true, role: true },
      });
      if (!user) throw new NotFoundException('User not found');
      if (!user.isActive) {
        throw new BadRequestException('Your account is disabled. You cannot place orders.');
      }
      ownerUserId = user.id;
      ownerRole = user.role;
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

    // Reseller orders (admin) and web orders from RESELLER accounts use the
    // reseller price; everyone else pays the customer price. Bulk/credit orders
    // ignore both and use the admin-entered per-line rate.
    const useResellerPrice = isResellerOrder || ownerRole === 'RESELLER';

    // Shipping is baked into the reseller price. When a reseller self-handles
    // delivery (pickup / label), strip a per-unit shipping deduction from each
    // reseller line so they aren't charged for shipping we don't do. Credit/bulk
    // orders carry an explicit per-line rate and are never adjusted.
    const isPickupOrder = input.isPickup ?? false;
    const perUnitDeduction =
      useResellerPrice && isPickupOrder
        ? (await this.settings.getPricing()).resellerShippingDeduction
        : 0;

    // Collapse duplicate lines (same product + variant) into one, summing the
    // quantity. Without this the same variant could appear twice, producing two
    // order lines and two stock decrements against a stale pre-check. The first
    // line's unitPrice wins (identical variant ⇒ same price for bulk lines too).
    const mergedItems = Array.from(
      input.items
        .reduce((map, item) => {
          const key = `${item.productId}::${item.variantId}`;
          const existing = map.get(key);
          if (existing) existing.quantity += item.quantity;
          else map.set(key, { ...item });
          return map;
        }, new Map<string, (typeof input.items)[number]>())
        .values(),
    );

    // Fetch every requested variant in a single query (avoids one round-trip per item).
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: mergedItems.map((i) => i.variantId) } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            customerPrice: true,
            resellerPrice: true,
          },
        },
        size: { select: { label: true } },
      },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const itemsWithDetails: ItemWithDetails[] = mergedItems.map((item) => {
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
        // Bulk/credit orders carry an explicit per-line rate (validated present
        // by the schema); everyone else derives it from the product.
        unitPrice: isCreditOrder
          ? item.unitPrice!
          : useResellerPrice
            ? Math.max(0, variant.product.resellerPrice - perUnitDeduction)
            : variant.product.customerPrice,
        quantity: item.quantity,
      };
    });

    // Compute totals
    const subtotal = itemsWithDetails.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    // Shipping charge is admin-controlled; a web customer can't set it (the
    // create endpoint is open, so gate it — web orders always default to 0).
    const shipping = isAdminCreated ? (input.shipping ?? 0) : 0;
    const total = subtotal + shipping;

    // Credit-customer orders are always BULK. Admins may set the order type
    // (reseller BULK/SINGLE); a web customer never can — force SINGLE so the
    // open create endpoint can't be used to inject a privileged order type.
    const orderType = isCreditOrder
      ? ORDER_TYPE.BULK
      : isAdminCreated
        ? (input.orderType ?? ORDER_TYPE.SINGLE)
        : ORDER_TYPE.SINGLE;

    // Admin-created orders are pre-approved; web orders start as PENDING.
    const status = isAdminCreated
      ? input.paymentStatus === PAYMENT_STATUS.RECEIVED
        ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
        : ORDER_STATUS.APPROVED_PAYMENT_PENDING
      : ORDER_STATUS.PENDING;

    // Payment status is DERIVED from the order status, never trusted from input:
    // the create endpoint is open to any authenticated user, so a web customer
    // must not be able to mark their own order paid. Shipping status is admin-only
    // too; a web order always starts PENDING.
    const paymentStatus = PAYMENT_FOR_STATUS[status];
    const shippingStatus = isAdminCreated
      ? (input.shippingStatus ?? PAYMENT_STATUS.PENDING)
      : PAYMENT_STATUS.PENDING;

    const addr = input.address;

    // Pickup orders (reseller selects in-store collection) don't collect a
    // shipping address. The DB address columns are non-nullable, so persist
    // empty fallbacks for pickup so the schema stays intact.
    const addressData = addr
      ? {
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
        }
      : {
          addressName: '',
          addressEmail: null,
          addressMobileNo: '',
          addressAltMobileNo: null,
          addressLine1: '',
          addressLine2: '',
          landmark: '',
          pincode: '',
          city: '',
          state: '',
        };

    // Create the order in a transaction, retrying only on an order-number
    // collision (regenerate + retry) and resolving an idempotency-key race to
    // the winning order. An explicit timeout keeps a large basket's sequential
    // stock decrements from tripping Prisma's 5s interactive-transaction default.
    const MAX_ORDER_NUMBER_ATTEMPTS = 5;
    let order: OrderWithDetails | undefined;
    for (let attempt = 1; ; attempt++) {
      const orderNumber = generateOrderNumber();
      try {
        order = await this.prisma.$transaction(
          async (tx) => {
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

            // Clear cart items for this user (web flow only — admin-created orders don't touch the cart).
            // Single relation-filtered delete keeps the transaction open for one fewer round-trip.
            if (!isAdminCreated) {
              await tx.cartItem.deleteMany({ where: { cart: { userId } } });
            }

            return tx.order.create({
              data: {
                orderNumber,
                idempotencyKey: idemKey ?? null,
                userId: ownerUserId,
                creditCustomerId: ownerCreditCustomerId,
                status,
                paymentStatus,
                orderType,
                shippingStatus,
                subtotal,
                shipping,
                total,
                isPickup: input.isPickup ?? false,
                ...addressData,
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
          },
          { timeout: 20_000, maxWait: 10_000 },
        );
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = Array.isArray(error.meta?.target)
            ? (error.meta?.target as string[]).join(',')
            : String(error.meta?.target ?? '');
          // Lost an idempotency race: a concurrent request with the same key
          // already created the order — return that one, don't create a second.
          if (idemKey && target.includes('idempotencyKey')) {
            const winner = await this.prisma.order.findUnique({
              where: { idempotencyKey: idemKey },
              include: orderDetailInclude,
            });
            if (winner) {
              this.logger.debug(
                `[ORDER DEBUG] idempotency race resolved to existing order ${winner.orderNumber}`,
              );
              return toOrderDto(winner);
            }
          }
          // Order-number collision (astronomically rare): regenerate and retry.
          if (target.includes('orderNumber') && attempt < MAX_ORDER_NUMBER_ATTEMPTS) {
            this.logger.warn(
              `Order number collision on ${orderNumber} — regenerating (attempt ${attempt}/${MAX_ORDER_NUMBER_ATTEMPTS}).`,
            );
            continue;
          }
        }
        // Anything else (stock BadRequestException, DB/connection failure) is
        // surfaced unchanged — HttpExceptions map to their status; the rest 500.
        throw error;
      }
    }
    // The loop only exits via break (order assigned), an early return, or throw.
    if (!order) throw new Error('Order creation did not produce an order.');

    const dto = toOrderDto(order);
    this.logger.debug(
      `[ORDER DEBUG] order CREATED id=${order.id} orderNumber=${order.orderNumber} total=${order.total} items=${order.items.length} — committed to DB`,
    );
    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.CREATION,
      moduleId: order.id,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} created${isAdminCreated ? ' (admin)' : ''}`,
      formData: { ...dto },
      auditedBy,
    });

    // Pickup orders are collected in store — no courier is involved, so skip
    // the Shipmozo push entirely. Shipping orders push in the BACKGROUND.
    // Checkout latency is never coupled to the courier API: the response returns
    // immediately and the push resolves on its own. It runs only after the
    // order transaction has committed, and pushForOrder records any courier-side
    // error on the order itself rather than throwing — so a slow or failing
    // Shipmozo can neither delay, block, nor roll back a successful checkout.
    // The admin can retry from the order page if the background push fails.
    if (!order.isPickup) {
      this.logger.debug(
        `[ORDER DEBUG] launching BACKGROUND Shipmozo push for order ${order.orderNumber} (id=${order.id})`,
      );
      void this.shipment
        .pushForOrder(order.id, auditedBy)
        .then((shipment) => {
          this.logger.debug(
            `[ORDER DEBUG] background push finished for ${order.orderNumber}: status=${shipment.shipmentStatus} tracking=${shipment.trackingId ?? 'none'} courier=${shipment.courierPartner ?? 'none'} error=${shipment.shipmentError ?? 'none'}`,
          );
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.debug(
            `[ORDER DEBUG] background push THREW for ${order.orderNumber}: ${message}`,
          );
          this.logger.error(`Background Shipmozo push threw for ${order.orderNumber}: ${message}`);
        });
    }

    return dto;
  }

  /** Get orders for the currently authenticated user (web profile). */
  async findMyOrders(userId: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] findMyOrders START userId=${userId}`);

    const data = await this.prisma.order.findMany({
      where: { userId },
      include: orderDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    this.logger.debug(
      `[ORDER DEBUG] findMyOrders found ${data.length} orders for userId=${userId}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.READ,
      moduleId: userId,
      subModule: 'my-orders',
      action: `Retrieved ${data.length} orders for user ${userId}`,
      formData: { count: data.length, orderIds: data.map((o) => o.id) },
      auditedBy,
    });

    // Same shape as the full order DTO minus the owner identity (the caller
    // already knows it's their own order).
    return data.map((order) => {
      const { userId: _userId, userName: _userName, ...rest } = toOrderDto(order);
      // Customers see only the courier/tracking/status, never internal ids or errors.
      return { ...rest, shipment: mapShipment(order, false) };
    });
  }

  async findAll(query: OrderQuerySchema, auditedBy?: string) {
    const { page, pageSize, search, status, startDate, endDate, sort } = query;

    this.logger.debug(
      `[ORDER DEBUG] findAll START page=${page} pageSize=${pageSize} search=${search ?? 'none'} status=${status ?? 'none'}`,
    );

    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (search) {
      where['OR'] = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    // Selected dates are IST calendar days resolved to UTC instants (see
    // buildCreatedAtRange). An order placed at 02:00 IST on Aug 4 is 20:30 UTC
    // on Aug 3, so a naive UTC-day filter would drop it from an "Aug 4" range.
    const createdAtRange = buildCreatedAtRange(startDate, endDate);
    if (createdAtRange) where['createdAt'] = createdAtRange;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true } },
          creditCustomer: { select: { id: true, name: true } },
          items: { select: { quantity: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.debug(
      `[ORDER DEBUG] findAll returned ${data.length} orders (total: ${total}) page=${page}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.READ,
      subModule: 'list',
      action: `Listed orders (page ${page}, ${data.length} of ${total} results)`,
      formData: { page, pageSize, search, status, startDate, endDate, sort, total },
      auditedBy,
    });

    return {
      data: data.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        userName: ownerName(order),
        // Credit-customer (bulk) orders have no login role; surface them as CREDIT.
        userRole: order.user?.role ?? 'CREDIT',
        isPickup: order.isPickup,
        deliveryName: order.isPickup ? null : (order.addressName ?? null),
        status: order.status,
        shipmentStatus: order.shipmentStatus,
        trackingId: order.trackingId,
        courierPartner: order.courierPartner,
        // Total units ordered (sum of line-item quantities), not the number of lines.
        itemsCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
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
  async paymentPendingSummary(auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] paymentPendingSummary START`);

    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      _sum: { total: true },
      _count: { _all: true },
    });

    // Credit-customer (bulk) orders group under a null userId — exclude them here;
    // their receivables are surfaced separately.
    const userGroups = grouped.filter((g): g is typeof g & { userId: string } => g.userId !== null);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userGroups.map((g) => g.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const result = userGroups
      .map((g) => ({
        userId: g.userId,
        userName: nameById.get(g.userId) ?? 'Unknown',
        orderCount: g._count._all,
        totalPending: g._sum.total ?? 0,
      }))
      .sort((a, b) => b.totalPending - a.totalPending);

    this.logger.debug(
      `[ORDER DEBUG] paymentPendingSummary returned ${result.length} customers with pending payments`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.READ,
      subModule: 'payment-pending-summary',
      action: `Retrieved payment pending summary: ${result.length} customers with pending orders`,
      formData: {
        customerCount: result.length,
        totalPending: result.reduce((sum, c) => sum + c.totalPending, 0),
      },
      auditedBy,
    });

    return result;
  }

  /** The approved-payment-pending orders for one user (the card's detail view). */
  async paymentPendingForUser(userId: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] paymentPendingForUser START userId=${userId}`);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) {
      this.logger.debug(`[ORDER DEBUG] paymentPendingForUser NOT FOUND userId=${userId}`);
      throw new NotFoundException('User not found');
    }

    const orders = await this.prisma.order.findMany({
      where: { userId, status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const totalPending = orders.reduce((sum, o) => sum + o.total, 0);

    this.logger.debug(
      `[ORDER DEBUG] paymentPendingForUser found ${orders.length} orders for userId=${userId} totalPending=${totalPending}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.READ,
      moduleId: userId,
      subModule: 'payment-pending-user',
      action: `Retrieved ${orders.length} payment-pending orders for user ${user.name}`,
      formData: {
        userId,
        userName: user.name,
        orderCount: orders.length,
        totalPending,
        orderIds: orders.map((o) => o.id),
      },
      auditedBy,
    });

    return {
      userId: user.id,
      userName: user.name,
      totalPending,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        itemsCount: o._count.items,
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
    this.logger.debug(`[ORDER DEBUG] settlePaymentForUser START userId=${userId}`);

    const result = await this.prisma.order.updateMany({
      where: { userId, status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
      data: {
        status: ORDER_STATUS.APPROVED_PAYMENT_RECEIVED,
        paymentStatus: PAYMENT_STATUS.RECEIVED,
      },
    });

    this.logger.debug(
      `[ORDER DEBUG] settlePaymentForUser SUCCESS userId=${userId} settled=${result.count}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.UPDATION,
      moduleId: userId,
      subModule: 'payment-settlement',
      action: `Settled ${result.count} pending payment order(s) for user ${userId}`,
      formData: {
        userId,
        settled: result.count,
        newStatus: ORDER_STATUS.APPROVED_PAYMENT_RECEIVED,
        paymentStatus: PAYMENT_STATUS.RECEIVED,
      },
      auditedBy,
    });

    return { settled: result.count };
  }

  async findOne(id: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] findOne START id=${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderDetailInclude,
    });
    if (!order) {
      this.logger.debug(`[ORDER DEBUG] findOne NOT FOUND id=${id}`);
      this.audit.log({
        module: AuditModule.ORDERS,
        event: AuditEvent.READ,
        moduleId: id,
        subModule: 'detail',
        action: `Attempted to view order ${id} — not found`,
        formData: { orderId: id, found: false },
        auditedBy,
      });
      throw new NotFoundException(`Order ${id} not found`);
    }

    this.logger.debug(
      `[ORDER DEBUG] findOne SUCCESS id=${id} orderNumber=${order.orderNumber} status=${order.status}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.READ,
      moduleId: id,
      subModule: 'detail',
      referenceNumber: order.orderNumber,
      action: `Viewed order ${order.orderNumber}`,
      formData: { orderId: id, orderNumber: order.orderNumber, status: order.status },
      auditedBy,
    });

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
    this.logger.debug(
      `[ORDER DEBUG] transition START id=${id} target=${target} auditedBy=${auditedBy ?? 'none'}`,
    );

    // Only scalar OrderItem columns are read below (variantId/quantity for the
    // stock moves, title/sizeLabel for error messages) — no need to join the
    // ProductVariant relation.
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: {
          select: { variantId: true, quantity: true, title: true, sizeLabel: true },
        },
      },
    });
    if (!order) {
      this.logger.debug(`[ORDER DEBUG] transition NOT FOUND id=${id}`);
      throw new NotFoundException(`Order ${id} not found`);
    }

    const current = order.status as OrderStatus;
    if (current === target) {
      this.logger.debug(`[ORDER DEBUG] transition NOOP id=${id} already at ${target}`);
      return this.findOne(id, auditedBy);
    }

    const leavingRejected = current === ORDER_STATUS.REJECTED;
    const enteringRejected = target === ORDER_STATUS.REJECTED;

    this.logger.debug(
      `[ORDER DEBUG] transition id=${id} ${current} → ${target} leavingRejected=${leavingRejected} enteringRejected=${enteringRejected}`,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
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

      // Return the fully-mapped order straight from the write, so we don't
      // re-query it just to build the response DTO.
      return tx.order.update({
        where: { id },
        data: { status: target, paymentStatus: PAYMENT_FOR_STATUS[target] },
        include: orderDetailInclude,
      });
    });

    this.logger.debug(
      `[ORDER DEBUG] transition SUCCESS id=${id} ${current} → ${target} orderNumber=${order.orderNumber}`,
    );

    this.audit.log({
      module: AuditModule.ORDERS,
      event: AuditEvent.UPDATION,
      moduleId: order.id,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} status changed: ${current} → ${target}`,
      formData: {
        from: current,
        to: target,
        leavingRejected,
        enteringRejected,
        stockAdjusted: leavingRejected || enteringRejected,
      },
      auditedBy,
    });

    // Cancelling the order (→ REJECTED) also cancels it in the Shipmozo panel
    // to keep both sides in sync. Runs in the background and never throws, so a
    // courier-side failure can't block or roll back the status change.
    if (enteringRejected) {
      this.logger.debug(
        `[ORDER DEBUG] order ${order.orderNumber} rejected — triggering Shipmozo cancel sync`,
      );
      void this.shipment.cancelForOrder(id, auditedBy).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Background Shipmozo cancel threw for ${order.orderNumber}: ${message}`);
      });
    }

    return toOrderDto(updated);
  }

  /** Manual status change from the admin UI — delegates to {@link transition}. */
  updateStatus(id: string, input: UpdateOrderStatusSchema, auditedBy?: string) {
    return this.transition(id, input.status as OrderStatus, auditedBy);
  }

  async remove(id: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] remove START id=${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: { select: { variantId: true, quantity: true } },
      },
    });
    if (!order) {
      this.logger.debug(`[ORDER DEBUG] remove NOT FOUND id=${id}`);
      throw new NotFoundException(`Order ${id} not found`);
    }

    // Keep Shipmozo in sync: cancel the shipment there BEFORE we delete the
    // order row (afterwards its Shipmozo ids would be gone). Awaited but never
    // throws, and persist=false since the row is about to be removed.
    this.logger.debug(
      `[ORDER DEBUG] deleting order ${order.orderNumber} — syncing Shipmozo cancel first`,
    );
    await this.shipment.cancelForOrder(id, auditedBy, false);

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

    this.logger.debug(
      `[ORDER DEBUG] remove SUCCESS id=${id} orderNumber=${order.orderNumber} stockReleased=${releaseStock}`,
    );

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
    this.logger.debug(
      `[ORDER DEBUG] approve START id=${id} paymentStatus=${paymentStatus} auditedBy=${auditedBy ?? 'none'}`,
    );
    const target =
      paymentStatus === PAYMENT_STATUS.RECEIVED
        ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
        : ORDER_STATUS.APPROVED_PAYMENT_PENDING;
    this.logger.debug(`[ORDER DEBUG] approve delegating to transition id=${id} target=${target}`);
    return this.transition(id, target, auditedBy);
  }

  /** Revert an order back to PENDING (re-reserving stock if it was rejected). */
  undo(id: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] undo START id=${id} auditedBy=${auditedBy ?? 'none'}`);
    return this.transition(id, ORDER_STATUS.PENDING, auditedBy);
  }

  /** Reject an order and restore its stock to inventory. */
  reject(id: string, auditedBy?: string) {
    this.logger.debug(`[ORDER DEBUG] reject START id=${id} auditedBy=${auditedBy ?? 'none'}`);
    return this.transition(id, ORDER_STATUS.REJECTED, auditedBy);
  }
}
