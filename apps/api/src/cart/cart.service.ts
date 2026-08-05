import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule, type UserRole } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const include = { items: { include: { product: true, variant: { include: { size: true } } }, orderBy: { createdAt: 'desc' as const } } };

type CartWithItems = Awaited<ReturnType<PrismaService['cart']['upsert']>> & {
  items: Array<{ product: Record<string, unknown> }>;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(userId: string, role?: UserRole) {
    const cart = (await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include,
    })) as unknown as CartWithItems;
    return this.shapeCart(cart, role);
  }

  /**
   * Collapse each cart item's product down to a single role-appropriate `price`
   * (reseller price for RESELLER, customer price otherwise) and strip the raw
   * pricing breakdown so the storefront never sees more than one price.
   */
  private shapeCart(cart: CartWithItems, role?: UserRole) {
    return {
      ...cart,
      items: cart.items.map((item) => {
        const product = item.product as Record<string, unknown> & {
          inhouseCost: number;
          resellerPrice: number;
          customerPrice: number;
        };
        const price = role === 'RESELLER' ? product.resellerPrice : product.customerPrice;
        const { inhouseCost: _c, resellerPrice: _r, customerPrice: _cu, ...rest } = product;
        return { ...item, product: { ...rest, price } };
      }),
    };
  }

  async add(userId: string, input: { productId: string; variantId: string; quantity?: number }, role?: UserRole, auditedBy?: string) {
    const quantity = input.quantity ?? 1;
    if (!input.productId || !input.variantId || !Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('A product, size, and positive quantity are required');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId }, select: { id: true, stock: true } });
    if (!variant) throw new NotFoundException('Selected product size was not found');
    if (variant.stock < 1) throw new BadRequestException('Sorry, this size is out of stock.');
    if (variant.stock < quantity) throw new BadRequestException(`Only ${variant.stock} left in this size — please lower the quantity.`);
    // Read-modify-write in one transaction so two concurrent adds can't each
    // read the same "existing" quantity and both increment past available stock.
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
      const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } } });
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      if (nextQuantity > variant.stock) {
        throw new BadRequestException(
          "You've reached the maximum quantity available for this size.",
        );
      }
      await tx.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } }, create: { cartId: cart.id, productId: input.productId, variantId: variant.id, quantity }, update: { quantity: nextQuantity } });
    });
    this.audit.log({
      module: AuditModule.CART,
      event: AuditEvent.CREATION,
      moduleId: variant.id,
      action: `Added ${quantity} of variant ${variant.id} to cart`,
      formData: { productId: input.productId, variantId: variant.id, quantity },
      auditedBy,
    });
    return this.get(userId, role);
  }

  async update(userId: string, itemId: string, quantity: number, role?: UserRole, auditedBy?: string) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('Quantity must be at least 1');
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: { variant: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity > item.variant.stock) throw new BadRequestException(`Only ${item.variant.stock} available in this size — please choose a lower quantity.`);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    this.audit.log({
      module: AuditModule.CART,
      event: AuditEvent.UPDATION,
      moduleId: itemId,
      action: `Cart item ${itemId} quantity set to ${quantity}`,
      formData: { itemId, quantity },
      auditedBy,
    });
    return this.get(userId, role);
  }

  async remove(userId: string, itemId: string, role?: UserRole, auditedBy?: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, select: { id: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    this.audit.log({
      module: AuditModule.CART,
      event: AuditEvent.DELETION,
      moduleId: itemId,
      action: `Cart item ${itemId} removed`,
      auditedBy,
    });
    return this.get(userId, role);
  }
}
