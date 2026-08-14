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
  dimension: true,
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

// Storefront callers never see a product with nothing in stock — a product
// whose variants are all at stock 0 (or has no variants) is hidden entirely,
// rather than surfaced as a "sold out" card. ADMIN is exempt.
const inStock: Prisma.ProductWhereInput = { variants: { some: { stock: { gt: 0 } } } };

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

    // Only ADMIN sees deactivated products; every other caller (reseller,
    // customer, anonymous storefront) is limited to active ones.
    const activeOnly = user?.role !== 'ADMIN';

    const buildWhere = (withSearch: boolean): Prisma.ProductWhereInput => ({
      deletedAt: null,
      ...(activeOnly ? { isActive: true, ...inStock } : {}),
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

    // Colorways of a model sit together because they share `groupSortAt` (the
    // group's newest createdAt, maintained on write — see recomputeGroupSort).
    // Ordering by it puts the freshest model first, then the group's own
    // fields keep its colorways adjacent and newest-first. This is a plain
    // indexed ORDER BY … LIMIT — no per-request grouping/sorting of the whole
    // catalog, so response time stays flat as the catalog grows.
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { groupSortAt: 'desc' },
      { brandId: 'asc' },
      { model: 'asc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

    const runPage = async (where: Prisma.ProductWhereInput) =>
      Promise.all([
        this.prisma.product.findMany({
          where,
          include: storefrontInclude,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.product.count({ where }),
      ]);

    let [rows, total] = await runPage(buildWhere(true));

    // Fallback: a search that matches nothing shows the full catalog instead.
    if (search && total === 0) {
      [rows, total] = await runPage(buildWhere(false));
    }

    return {
      data: rows.map((row) => shapeProduct(row, user)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Recompute `groupSortAt` for a colorway group so its members share one sort
   * timestamp = the group's newest `createdAt`. Called after any write that can
   * change a group's membership or recency (create / model or brand change /
   * soft-delete / restore). A no-model product is its own group and simply
   * keeps `groupSortAt = createdAt` (the column default), so nothing to do.
   *
   * Runs as a single correlated UPDATE — O(group size), not O(catalog).
   */
  private async recomputeGroupSort(brandId: string | null, model: string | null): Promise<void> {
    const trimmed = model?.trim();
    if (!brandId || !trimmed) return; // solo product → default groupSortAt = createdAt

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Product" g
      SET "groupSortAt" = sub.mx
      FROM (
        SELECT MAX("createdAt") AS mx
        FROM "Product"
        WHERE "deletedAt" IS NULL
          AND "brandId" = ${brandId}
          AND lower(trim("model")) = lower(${trimmed})
      ) sub
      WHERE g."deletedAt" IS NULL
        AND g."brandId" = ${brandId}
        AND lower(trim(g."model")) = lower(${trimmed})
    `);
  }

  /**
   * Distinct model names for the admin's autocomplete, most-used first.
   * Optionally scoped to a brand so suggestions stay relevant to the selection.
   */
  async listModels(brandId?: string): Promise<string[]> {
    const grouped = await this.prisma.product.groupBy({
      by: ['model'],
      where: { deletedAt: null, model: { not: null }, ...(brandId ? { brandId } : {}) },
      _count: { _all: true },
      orderBy: { _count: { model: 'desc' } },
      take: 200,
    });
    return grouped.map((g) => g.model).filter((m): m is string => !!m && m.trim().length > 0);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null, ...(user?.role === 'ADMIN' ? {} : { isActive: true, ...inStock }) },
      include: storefrontInclude,
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return shapeProduct(product, user);
  }

  /**
   * Products to show in the "Similar products" rail on a product page, in
   * priority order (up to {@link SIMILAR_LIMIT}, never repeating a product):
   *   1. Same brand AND a shared model keyword — e.g. "Samba Black" surfaces the
   *      brand's other "Samba …" (White, Maroon). The keyword is the first word
   *      of the name (sneaker names are model-first), matched anywhere in name.
   *   2. Any other product from the same brand.
   *   3. Products from other brands (newest first) to fill the remaining slots.
   * Returns [] for a missing/deleted product rather than throwing, so the rail
   * simply doesn't render.
   */
  async findSimilar(id: string, user?: AuthenticatedUser) {
    const SIMILAR_LIMIT = 8;
    const current = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, brand: true, brandId: true },
    });
    if (!current) return [];

    const collected: ProductWithRelations[] = [];
    const seen = new Set<string>([current.id]);

    // Match the brand by relation id when present, else by the free-text brand.
    const sameBrand: Prisma.ProductWhereInput = current.brandId
      ? { brandId: current.brandId }
      : { brand: { equals: current.brand, mode: 'insensitive' } };

    const pull = async (where: Prisma.ProductWhereInput) => {
      const remaining = SIMILAR_LIMIT - collected.length;
      if (remaining <= 0) return;
      const rows = await this.prisma.product.findMany({
        where: { deletedAt: null, isActive: true, ...inStock, id: { notIn: Array.from(seen) }, ...where },
        include: storefrontInclude,
        take: remaining,
        orderBy: { createdAt: 'desc' },
      });
      for (const row of rows) {
        seen.add(row.id);
        collected.push(row);
      }
    };

    // Tier 1 — same brand + shared model keyword (first word of the name).
    const modelKeyword = current.name.trim().split(/\s+/)[0] ?? '';
    if (modelKeyword.length >= 2) {
      await pull({ ...sameBrand, name: { contains: modelKeyword, mode: 'insensitive' } });
    }
    // Tier 2 — anything else from the same brand.
    await pull(sameBrand);
    // Tier 3 — other brands, newest first, to top up the rail.
    await pull({});

    return collected.map((row) => shapeProduct(row, user));
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
      // New product is the group's newest → refresh the group's shared sort key.
      await this.recomputeGroupSort(brandId, data.model ?? null);
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
    // Capture the pre-update group so we can refresh both it and the new one
    // if the model/brand moves the product between groups.
    const before = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { brandId: true, model: true },
    });
    if (!before) throw new NotFoundException(`Product ${id} not found`);
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

    // Refresh the group sort key. If the product moved groups (brand/model
    // changed) both the old and new groups need recomputing.
    const newBrandId = brandId ?? before.brandId;
    const newModel = data.model !== undefined ? data.model : before.model;
    await this.recomputeGroupSort(before.brandId, before.model);
    if (newBrandId !== before.brandId || (newModel ?? '') !== (before.model ?? '')) {
      await this.recomputeGroupSort(newBrandId, newModel);
    }

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
      select: { id: true, sku: true, name: true, brandId: true, model: true },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    // Free the SKU (it's unique) so a new product can reuse it, while keeping
    // the row for order history. The mangled value stays hidden from all reads.
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), sku: `${product.sku}::deleted::${id}` },
    });
    // Removing a colorway can lower its group's newest date — refresh the rest.
    await this.recomputeGroupSort(product.brandId, product.model);
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
