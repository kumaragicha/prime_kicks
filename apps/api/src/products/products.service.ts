import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProductSchema,
  ProductQuerySchema,
  UpdateProductSchema,
} from '@prime-kicks/validation';
import { AuditEvent, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const productInclude = {
  brandRef: true,
  productTypes: true,
  categories: true,
  tags: true,
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

/**
 * Shape a product for the caller based on their role (derived from the JWT).
 *
 * The single `price` key is what the storefront renders — there is no
 * role branching on the frontend:
 *   - RESELLER            → reseller price
 *   - CUSTOMER / anonymous → customer price
 *
 * Non-admin callers never receive the raw pricing breakdown
 * (`inhouseCost` / `resellerPrice` / `customerPrice`); those are stripped so
 * the storefront can never expose more than one price. ADMIN keeps the full
 * breakdown for the admin dashboard, plus `price` for consistency.
 */
function shapeProduct(product: ProductWithRelations, user?: AuthenticatedUser) {
  const base = withTotalStock(product);
  const price = user?.role === 'RESELLER' ? product.resellerPrice : product.customerPrice;

  if (user?.role === 'ADMIN') {
    return { ...base, price };
  }

  const { inhouseCost, resellerPrice, customerPrice, ...rest } = base;
  return { ...rest, price };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ProductQuerySchema, user?: AuthenticatedUser) {
    const { page, pageSize, brandId, categoryId, tagId, tag, sizeTypeId, size, search } = query;

    const buildWhere = (withSearch: boolean): Prisma.ProductWhereInput => ({
      deletedAt: null,
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categories: { some: { id: categoryId } } } : {}),
      ...(tagId ? { tags: { some: { id: tagId } } } : {}),
      ...(tag ? { tags: { some: { name: { equals: tag, mode: 'insensitive' } } } } : {}),
      ...(sizeTypeId ? { sizeTypeId } : {}),
      // A product matches a size only if it has that size in stock.
      ...(size ? { variants: { some: { stock: { gt: 0 }, size: { label: size } } } } : {}),
      ...(withSearch && search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
              { brandRef: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    });

    let where = buildWhere(true);

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

    // Fallback: if the search returned no results, show all products (ignoring search).
    if (search && rows.length === 0) {
      where = buildWhere(false);
      const [fallbackRows, fallbackTotal] = await Promise.all([
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
        data: fallbackRows.map((row) => shapeProduct(row, user)),
        meta: {
          page,
          pageSize,
          total: fallbackTotal,
          totalPages: Math.ceil(fallbackTotal / pageSize),
        },
      };
    }

    return {
      data: rows.map((row) => shapeProduct(row, user)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: storefrontInclude,
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return shapeProduct(product, user);
  }

  async create(input: CreateProductSchema, auditedBy?: string) {
    const { variants, brandId, productTypeIds, categoryIds, tagIds, ...data } = input;
    const brand = await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId } });

    // Auto-generate SKU if not provided
    const sku = data.sku?.trim() || this.generateSku(brand.name);

    try {
      const product = await this.prisma.product.create({
        data: {
          ...data,
          sku,
          brand: brand.name,
          brandId,
          productTypes: { connect: productTypeIds.map((id) => ({ id })) },
          categories: { connect: categoryIds.map((id) => ({ id })) },
          tags: { connect: (tagIds ?? []).map((id) => ({ id })) },
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
      this.audit.log({
        module: AuditModule.PRODUCTS,
        event: AuditEvent.CREATION,
        moduleId: product.id,
        referenceNumber: product.sku,
        action: `Product "${product.name}" created`,
        formData: { ...product },
        auditedBy,
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

  async update(id: string, input: UpdateProductSchema, auditedBy?: string) {
    await this.ensureExists(id);
    const { variants, brandId, productTypeIds, categoryIds, tagIds, ...data } = input;
    const brand = brandId
      ? await this.prisma.brand.findUniqueOrThrow({ where: { id: brandId } })
      : null;

    const product = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...data,
          ...(brand ? { brandId, brand: brand.name } : {}),
          ...(productTypeIds
            ? { productTypes: { set: productTypeIds.map((id) => ({ id })) } }
            : {}),
          ...(categoryIds ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
          ...(tagIds ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}),
        },
      });

      if (variants) {
        const keep = variants.map((v) => v.sizeId);
        // Variants for sizes no longer offered on the product.
        const stale = await tx.productVariant.findMany({
          where: { productId: id, sizeId: { notIn: keep.length ? keep : ['__none__'] } },
          select: { id: true, _count: { select: { cartItems: true } } },
        });
        const deletable = stale.filter((v) => v._count.cartItems === 0).map((v) => v.id);
        const inCarts = stale.filter((v) => v._count.cartItems > 0).map((v) => v.id);
        if (deletable.length) {
          await tx.productVariant.deleteMany({ where: { id: { in: deletable } } });
        }
        // A variant still sitting in a customer's cart can't be deleted (the
        // CartItem FK is Restrict). Zero its stock instead: storefront reads only
        // expose in-stock sizes, so it disappears from the store while the cart
        // reference stays valid.
        if (inCarts.length) {
          await tx.productVariant.updateMany({ where: { id: { in: inCarts } }, data: { stock: 0 } });
        }
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

    this.audit.log({
      module: AuditModule.PRODUCTS,
      event: AuditEvent.UPDATION,
      moduleId: product.id,
      referenceNumber: product.sku,
      action: `Product "${product.name}" updated`,
      formData: { ...product },
      auditedBy,
    });

    return withTotalStock(product);
  }

  /**
   * Soft-delete the product: it disappears from the store and admin list
   * (all reads filter `deletedAt: null`) while the row stays intact so any
   * orders that reference it keep working. Always succeeds.
   */
  async remove(id: string, auditedBy?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, sku: true, name: true },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    // Free the SKU (it's unique) so a new product can reuse it, while keeping
    // the row for order history. The mangled value stays hidden from all reads.
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), sku: `${product.sku}::deleted::${id}` },
    });
    this.audit.log({
      module: AuditModule.PRODUCTS,
      event: AuditEvent.DELETION,
      moduleId: product.id,
      referenceNumber: product.sku,
      action: `Product "${product.name}" deleted`,
      formData: { ...product },
      auditedBy,
    });
    return { id, deleted: true };
  }

  private generateSku(brand: string): string {
    const prefix =
      brand
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PK';
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${stamp}${rand}`;
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
