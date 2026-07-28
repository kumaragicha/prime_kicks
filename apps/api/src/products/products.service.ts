import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateProductSchema,
  ProductQuerySchema,
  UpdateProductSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

const productInclude = {
  brandRef: true,
  productTypes: true,
  categories: true,
  sizeType: true,
  variants: {
    include: { size: true },
    orderBy: { size: { sortOrder: 'asc' } },
  },
} satisfies Prisma.ProductInclude;

// Storefront reads only ever expose sizes that are in stock — an out-of-stock
// size is never offered to the customer. Stock is decremented at order time,
// not when an item is added to the cart, so `stock > 0` reflects real availability.
const storefrontInclude = {
  ...productInclude,
  variants: {
    ...productInclude.variants,
    where: { stock: { gt: 0 } },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Add a computed `totalStock` (sum of all variant stock) to a product. */
function withTotalStock(product: ProductWithRelations) {
  return {
    ...product,
    brand: product.brandRef?.name ?? product.brand,
    totalStock: product.variants.reduce((sum, v) => sum + v.stock, 0),
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQuerySchema) {
    const { page, pageSize, brandId, categoryId, sizeTypeId, search } = query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categories: { some: { id: categoryId } } } : {}),
      ...(sizeTypeId ? { sizeTypeId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: storefrontInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map(withTotalStock),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: storefrontInclude,
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return withTotalStock(product);
  }

  async create(input: CreateProductSchema) {
    const { variants, brandId, productTypeIds, categoryIds, ...data } = input;
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
    try {
      const product = await this.prisma.product.create({
        data: {
          ...data,
          brand: brand.name,
          brandId,
          productTypes: { connect: productTypeIds.map((id) => ({ id })) },
          categories: { connect: categoryIds.map((id) => ({ id })) },
          variants: {
            create: variants.map((v) => ({
              sizeId: v.sizeId,
              stock: v.stock,
              sku: v.sku ?? null,
            })),
          },
        },
        include: productInclude,
      });
      return withTotalStock(product);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.modelName === 'Product'
      ) {
        throw new ConflictException(`A product with SKU "${data.sku}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateProductSchema) {
    await this.ensureExists(id);
    const { variants, brandId, productTypeIds, categoryIds, ...data } = input;
    const brand = brandId ? await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId } }) : null;

    const product = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: {
        ...data,
        ...(brand ? { brandId, brand: brand.name } : {}),
        ...(productTypeIds ? { productTypes: { set: productTypeIds.map((id) => ({ id })) } } : {}),
        ...(categoryIds ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
      } });

      if (variants) {
        const keep = variants.map((v) => v.sizeId);
        // Drop variants for sizes no longer present.
        await tx.productVariant.deleteMany({
          where: { productId: id, sizeId: { notIn: keep.length ? keep : ['__none__'] } },
        });
        // Upsert the provided ones.
        for (const v of variants) {
          await tx.productVariant.upsert({
            where: { productId_sizeId: { productId: id, sizeId: v.sizeId } },
            update: { stock: v.stock, sku: v.sku ?? null },
            create: { productId: id, sizeId: v.sizeId, stock: v.stock, sku: v.sku ?? null },
          });
        }
      }

      return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    });

    return withTotalStock(product);
  }

  /** Permanently delete the product and its variants. */
  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.product.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Cannot delete a product that is referenced by an order');
      }
      throw error;
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }
}
