import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Coupon, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  ApplyCouponSchema,
  CouponQuerySchema,
  CreateCouponSchema,
  UpdateCouponSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

/** The context a coupon is validated against at (or before) checkout. */
export interface CouponCheckoutContext {
  userId: string;
  role: UserRole;
  /** Order subtotal in whole rupees. */
  subtotal: number;
  /** Whether this is a prepaid (online-paid) order. */
  prepaid: boolean;
}

export interface ValidatedCoupon {
  couponId: string;
  code: string;
  /** Discount in whole rupees to subtract from the subtotal. */
  discount: number;
}

type CartItem = { productId: string; variantId: string; quantity: number };

function isUniqueViolation(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    (error.meta?.target as string[] | undefined)?.includes(field) === true
  );
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  /** Compute the rupee discount a coupon yields on a given subtotal. */
  private computeDiscount(coupon: Coupon, subtotal: number): number {
    let discount =
      coupon.type === 'PERCENT' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
    if (coupon.type === 'PERCENT' && coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    // Never discount more than the order is worth.
    return Math.max(0, Math.min(discount, subtotal));
  }

  // ─── Admin CRUD ──────────────────────────────────────────────────────────

  async list(query: CouponQuerySchema) {
    const { page, pageSize, search } = query;
    const where: Prisma.CouponWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async create(input: CreateCouponSchema): Promise<Coupon> {
    try {
      return await this.prisma.coupon.create({
        data: {
          code: this.normalizeCode(input.code),
          description: input.description ?? '',
          type: input.type,
          value: input.value,
          maxDiscount: input.type === 'PERCENT' ? (input.maxDiscount ?? null) : null,
          minOrderValue: input.minOrderValue ?? 0,
          customerOnly: input.customerOnly ?? true,
          prepaidOnly: input.prepaidOnly ?? true,
          usageLimit: input.usageLimit ?? null,
          perUserLimit: input.perUserLimit ?? null,
          validFrom: input.validFrom ? new Date(input.validFrom) : null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          isActive: input.isActive ?? true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'code')) {
        throw new BadRequestException('A coupon with this code already exists.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateCouponSchema): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const type = input.type ?? existing.type;
    try {
      return await this.prisma.coupon.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: this.normalizeCode(input.code) } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.value !== undefined ? { value: input.value } : {}),
          // maxDiscount only meaningful for PERCENT — clear it for FLAT.
          ...(input.maxDiscount !== undefined || input.type !== undefined
            ? { maxDiscount: type === 'PERCENT' ? (input.maxDiscount ?? null) : null }
            : {}),
          ...(input.minOrderValue !== undefined ? { minOrderValue: input.minOrderValue } : {}),
          ...(input.customerOnly !== undefined ? { customerOnly: input.customerOnly } : {}),
          ...(input.prepaidOnly !== undefined ? { prepaidOnly: input.prepaidOnly } : {}),
          ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit ?? null } : {}),
          ...(input.perUserLimit !== undefined ? { perUserLimit: input.perUserLimit ?? null } : {}),
          ...(input.validFrom !== undefined
            ? { validFrom: input.validFrom ? new Date(input.validFrom) : null }
            : {}),
          ...(input.validUntil !== undefined
            ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'code')) {
        throw new BadRequestException('A coupon with this code already exists.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    // Orders keep their couponCode snapshot; the FK is set null on delete.
    await this.prisma.coupon.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─── Checkout validation ─────────────────────────────────────────────────

  /** Sum the customer-price subtotal (whole rupees) for a set of cart items. */
  async computeSubtotal(items: CartItem[]): Promise<number> {
    const merged = new Map<string, CartItem>();
    for (const item of items) {
      const existing = merged.get(item.variantId);
      if (existing) existing.quantity += item.quantity;
      else merged.set(item.variantId, { ...item });
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...merged.keys()] } },
      include: { product: { select: { id: true, customerPrice: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    for (const item of merged.values()) {
      const variant = byId.get(item.variantId);
      if (!variant || variant.productId !== item.productId) {
        throw new NotFoundException('One of the items in your bag is no longer available.');
      }
      subtotal += variant.product.customerPrice * item.quantity;
    }
    return subtotal;
  }

  /**
   * Validate a coupon for a checkout, throwing a customer-friendly message when
   * it doesn't apply. Read-only — redemption counting happens when the order is
   * created (OrdersService), so the count stays accurate under retries.
   */
  async validateForCheckout(
    code: string,
    ctx: CouponCheckoutContext,
  ): Promise<ValidatedCoupon> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: this.normalizeCode(code) },
    });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('This coupon code is not valid.');
    }

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException('This coupon is not active yet.');
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (coupon.customerOnly && ctx.role !== 'CUSTOMER') {
      throw new BadRequestException('This coupon is only available to customers.');
    }
    if (coupon.prepaidOnly && !ctx.prepaid) {
      throw new BadRequestException('This coupon is valid on prepaid orders only.');
    }
    if (ctx.subtotal < coupon.minOrderValue) {
      throw new BadRequestException(
        `Add ₹${coupon.minOrderValue - ctx.subtotal} more to use this coupon (minimum order ₹${coupon.minOrderValue}).`,
      );
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }
    if (coupon.perUserLimit != null) {
      const usedByUser = await this.prisma.order.count({
        where: { couponId: coupon.id, userId: ctx.userId },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon.');
      }
    }

    const discount = this.computeDiscount(coupon, ctx.subtotal);
    if (discount <= 0) {
      throw new BadRequestException('This coupon gives no discount on your current bag.');
    }

    return { couponId: coupon.id, code: coupon.code, discount };
  }

  /** Storefront preview: price the cart and validate the coupon (prepaid, web). */
  async preview(userId: string, input: ApplyCouponSchema) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('Your account is disabled.');

    const subtotal = await this.computeSubtotal(input.items);
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: this.normalizeCode(input.code) },
    });
    // validateForCheckout re-reads the coupon; call it for the eligibility rules,
    // then shape the preview from the stored coupon for type/value display.
    const validated = await this.validateForCheckout(input.code, {
      userId,
      role: user.role,
      subtotal,
      prepaid: true, // web storefront checkout is always prepaid (Razorpay)
    });

    return {
      code: validated.code,
      type: coupon!.type,
      value: coupon!.value,
      discount: validated.discount,
      prepaidOnly: coupon!.prepaidOnly,
      subtotal,
      total: subtotal - validated.discount,
    };
  }
}
