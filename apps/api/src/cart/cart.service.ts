import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const include = { items: { include: { product: true, variant: { include: { size: true } } }, orderBy: { createdAt: 'desc' as const } } };

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, include });
  }

  async add(userId: string, input: { productId: string; variantId: string; quantity?: number }) {
    const quantity = input.quantity ?? 1;
    if (!input.productId || !input.variantId || !Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('A product, size, and positive quantity are required');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, productId: input.productId }, select: { id: true, stock: true } });
    if (!variant) throw new NotFoundException('Selected product size was not found');
    if (variant.stock < 1) throw new BadRequestException('Sorry, this size is out of stock.');
    if (variant.stock < quantity) throw new BadRequestException(`Only ${variant.stock} left in this size — please lower the quantity.`);
    const cart = await this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } } });
    if (existing && existing.quantity + quantity > variant.stock) {
      const remaining = variant.stock - existing.quantity;
      throw new BadRequestException(
        remaining > 0
          ? `You already have ${existing.quantity} in your cart and only ${remaining} more ${remaining === 1 ? 'is' : 'are'} available in this size.`
          : `You already have all ${variant.stock} available in this size in your cart.`,
      );
    }
    await this.prisma.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } }, create: { cartId: cart.id, productId: input.productId, variantId: variant.id, quantity }, update: { quantity: { increment: quantity } } });
    return this.get(userId);
  }

  async update(userId: string, itemId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('Quantity must be at least 1');
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: { variant: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity > item.variant.stock) throw new BadRequestException(`Only ${item.variant.stock} available in this size — please choose a lower quantity.`);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(userId);
  }

  async remove(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, select: { id: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.get(userId);
  }
}
