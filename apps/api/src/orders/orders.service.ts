import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ORDER_STATUS, ORDER_TYPE, PAYMENT_STATUS, type PaymentStatus } from '@prime-kicks/types';
import type {
  CreateOrderSchema,
  OrderQuerySchema,
  UpdateOrderStatusSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

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
      select: { id: true, name: true, isActive: true },
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
          unitPrice: isAdminCreated ? variant.product.resellerPrice : variant.product.customerPrice,
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

  async updateStatus(id: string, input: UpdateOrderStatusSchema) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: input.status as any },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, photoUrls: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      userId: updated.userId,
      userName: updated.user.name,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      orderType: updated.orderType,
      shippingStatus: updated.shippingStatus,
      items: updated.items.map((item) => ({
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
      subtotal: updated.subtotal,
      shipping: updated.shipping,
      total: updated.total,
      currency: updated.currency,
      address: {
        name: updated.addressName,
        email: updated.addressEmail,
        altMobileNo: updated.addressAltMobileNo,
        mobileNo: updated.addressMobileNo,
        line1: updated.addressLine1,
        line2: updated.addressLine2,
        landmark: updated.landmark,
        pincode: updated.pincode,
        city: updated.city,
        state: updated.state,
      },
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
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

  async approve(id: string, paymentStatus: PaymentStatus) {
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

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status:
          paymentStatus === PAYMENT_STATUS.RECEIVED
            ? ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
            : ORDER_STATUS.APPROVED_PAYMENT_PENDING,
        paymentStatus: paymentStatus,
      },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, photoUrls: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      userId: updated.userId,
      userName: updated.user.name,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      orderType: updated.orderType,
      shippingStatus: updated.shippingStatus,
      items: updated.items.map((item) => ({
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
      subtotal: updated.subtotal,
      shipping: updated.shipping,
      total: updated.total,
      currency: updated.currency,
      address: {
        name: updated.addressName,
        email: updated.addressEmail,
        altMobileNo: updated.addressAltMobileNo,
        mobileNo: updated.addressMobileNo,
        line1: updated.addressLine1,
        line2: updated.addressLine2,
        landmark: updated.landmark,
        pincode: updated.pincode,
        city: updated.city,
        state: updated.state,
      },
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async reject(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { variant: true },
        },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    // Restore stock for each item
    await this.prisma.$transaction(
      order.items.map((item) =>
        this.prisma.productVariant.update({
          where: { id: item.variantId ?? '' },
          data: { stock: { increment: item.quantity } },
        }),
      ),
    );

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: ORDER_STATUS.REJECTED },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, photoUrls: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      userId: updated.userId,
      userName: updated.user.name,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      orderType: updated.orderType,
      shippingStatus: updated.shippingStatus,
      items: updated.items.map((item) => ({
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
      subtotal: updated.subtotal,
      shipping: updated.shipping,
      total: updated.total,
      currency: updated.currency,
      address: {
        name: updated.addressName,
        email: updated.addressEmail,
        altMobileNo: updated.addressAltMobileNo,
        mobileNo: updated.addressMobileNo,
        line1: updated.addressLine1,
        line2: updated.addressLine2,
        landmark: updated.landmark,
        pincode: updated.pincode,
        city: updated.city,
        state: updated.state,
      },
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
