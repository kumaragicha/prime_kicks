import { Injectable } from '@nestjs/common';
import { ORDER_STATUS } from '@prime-kicks/types';
import { istDateKey, istDayBounds, istRecentDays } from '../common/date-range.util';
import { PrismaService } from '../prisma/prisma.service';

/** Row caps for the "top N" breakdowns on the Analytics page. */
const TOP_PRODUCTS = 20;
const TOP_BRANDS = 15;
const TOP_SIZES = 20;
const TOP_LOCATIONS = 20;
const TOP_CUSTOMERS = 10;
const STOCK_LIST_LIMIT = 60;
const DEAD_STOCK_LIMIT = 40;

/** A variant at or below this stock level is flagged "low" (0 = out of stock). */
const LOW_STOCK_THRESHOLD = 5;
/** A product with stock but no sales in this many days is "dead stock". */
const DEAD_STOCK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const NOT_REJECTED = { status: { not: ORDER_STATUS.REJECTED } } as const;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lean payload for the dashboard home: today's orders (with the fields needed
   * to act on them), all-time value/profit, and outstanding receivables. Kept
   * intentionally small so the home loads fast — the heavy breakdowns live in
   * {@link insights}. Rejected orders are excluded from money figures, but
   * today's *list* keeps them so an admin can undo a rejection.
   */
  async dashboard() {
    const now = new Date();
    const today = istDayBounds(now);

    const [totalsAgg, pendingGroup, todayOrders, profitRow] = await Promise.all([
      this.prisma.order.aggregate({
        where: NOT_REJECTED,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: today.gte, lte: today.lte } },
        include: {
          user: { select: { name: true, role: true } },
          creditCustomer: { select: { name: true } },
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Profit needs (soldPrice - inhouseCost) * qty across a join, which Prisma
      // can't express — a single raw aggregate keeps the home query cheap.
      this.prisma.$queryRaw<{ allProfit: number; todayProfit: number }[]>`
        SELECT
          COALESCE(SUM((oi."unitPrice" - p."inhouseCost") * oi.quantity), 0)::float8 AS "allProfit",
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${today.gte} AND o."createdAt" <= ${today.lte}
            THEN (oi."unitPrice" - p."inhouseCost") * oi.quantity ELSE 0 END), 0)::float8 AS "todayProfit"
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o.status <> 'REJECTED'
      `,
    ]);

    const { allProfit, todayProfit } = profitRow[0] ?? { allProfit: 0, todayProfit: 0 };
    const todayValue = todayOrders
      .filter((o) => o.status !== ORDER_STATUS.REJECTED)
      .reduce((sum, o) => sum + o.total, 0);

    return {
      today: {
        date: istDateKey(now),
        count: todayOrders.length,
        totalValue: todayValue,
        profit: Math.round(todayProfit),
        orders: todayOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          userName: o.user?.name ?? o.creditCustomer?.name ?? 'Unknown',
          userRole: o.user?.role ?? 'CREDIT',
          status: o.status,
          shipmentStatus: o.shipmentStatus,
          trackingId: o.trackingId,
          courierPartner: o.courierPartner,
          itemsCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
          total: o.total,
          currency: o.currency,
          createdAt: o.createdAt.toISOString(),
        })),
      },
      totals: {
        orders: totalsAgg._count._all,
        revenue: totalsAgg._sum.total ?? 0,
        profit: Math.round(allProfit),
      },
      pendingPayment: {
        customers: pendingGroup.length,
        orders: pendingGroup.reduce((n, g) => n + g._count._all, 0),
        outstanding: pendingGroup.reduce((n, g) => n + (g._sum.total ?? 0), 0),
      },
    };
  }

  /**
   * Inventory snapshot for the dedicated Inventory page. Everything reflects the
   * *current* stock state (not a time window): headline stock KPIs, the money
   * tied up in stock (at inhouse cost) and what it could realise (customer /
   * reseller price), a per-brand rollup, and a full per-product table the admin
   * can search and sort client-side. Only live products (deletedAt IS NULL) are
   * counted. "Dead stock" = has units but no non-rejected sale in the last
   * {@link DEAD_STOCK_DAYS} days.
   */
  async inventory() {
    const now = new Date();
    const deadSince = new Date(now.getTime() - DEAD_STOCK_DAYS * DAY_MS);

    const [products, soldRecently] = await Promise.all([
      this.prisma.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          isActive: true,
          inhouseCost: true,
          customerPrice: true,
          resellerPrice: true,
          variants: { select: { stock: true, size: { select: { label: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderItem.findMany({
        where: { order: { ...NOT_REJECTED, createdAt: { gte: deadSince } } },
        select: { productId: true },
        distinct: ['productId'],
      }),
    ]);

    const soldIds = new Set(soldRecently.map((r) => r.productId));

    // Running totals for the KPI strip.
    let totalUnits = 0;
    let totalVariants = 0;
    let inhouseValue = 0;
    let retailValue = 0;
    let resellerValue = 0;
    let activeProducts = 0;
    let outOfStockProducts = 0;
    let deadStockProducts = 0;
    let outOfStockVariants = 0;
    let lowStockVariants = 0;

    const brandMap = new Map<
      string,
      { brand: string; products: number; units: number; inhouseValue: number; retailValue: number }
    >();

    const rows = products.map((p) => {
      const units = p.variants.reduce((n, v) => n + v.stock, 0);
      const lowVariants = p.variants.filter((v) => v.stock > 0 && v.stock <= LOW_STOCK_THRESHOLD).length;
      const oosVariants = p.variants.filter((v) => v.stock <= 0).length;
      const productInhouse = units * p.inhouseCost;
      const productRetail = units * p.customerPrice;
      const productReseller = units * p.resellerPrice;

      totalUnits += units;
      totalVariants += p.variants.length;
      inhouseValue += productInhouse;
      retailValue += productRetail;
      resellerValue += productReseller;
      outOfStockVariants += oosVariants;
      lowStockVariants += lowVariants;
      if (p.isActive) activeProducts += 1;

      const isDead = units > 0 && !soldIds.has(p.id);
      if (isDead) deadStockProducts += 1;

      // Product-level status for the table's status column / filter.
      let status: 'out' | 'low' | 'ok';
      if (units <= 0) {
        status = 'out';
        outOfStockProducts += 1;
      } else if (lowVariants > 0 || units <= LOW_STOCK_THRESHOLD) {
        status = 'low';
      } else {
        status = 'ok';
      }

      const brand = p.brand || '—';
      const b = brandMap.get(brand) ?? {
        brand,
        products: 0,
        units: 0,
        inhouseValue: 0,
        retailValue: 0,
      };
      b.products += 1;
      b.units += units;
      b.inhouseValue += productInhouse;
      b.retailValue += productRetail;
      brandMap.set(brand, b);

      return {
        productId: p.id,
        sku: p.sku,
        title: p.name,
        brand,
        isActive: p.isActive,
        variants: p.variants.length,
        units,
        lowVariants,
        outOfStockVariants: oosVariants,
        inhouseCost: p.inhouseCost,
        customerPrice: p.customerPrice,
        resellerPrice: p.resellerPrice,
        inhouseValue: productInhouse,
        retailValue: productRetail,
        status,
        isDead,
        sizes: p.variants
          .map((v) => ({ sizeLabel: v.size.label, stock: v.stock }))
          .sort((a, b) => a.sizeLabel.localeCompare(b.sizeLabel, undefined, { numeric: true })),
      };
    });

    return {
      generatedAt: now.toISOString(),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      deadStockDays: DEAD_STOCK_DAYS,
      summary: {
        totalProducts: products.length,
        activeProducts,
        inactiveProducts: products.length - activeProducts,
        totalVariants,
        totalUnits,
        inhouseValue,
        retailValue,
        resellerValue,
        potentialProfit: retailValue - inhouseValue,
        outOfStockProducts,
        deadStockProducts,
        outOfStockVariants,
        lowStockVariants,
      },
      byBrand: [...brandMap.values()].sort((a, b) => b.inhouseValue - a.inhouseValue),
      products: rows.sort((a, b) => b.inhouseValue - a.inhouseValue),
    };
  }

  /**
   * Rich analytics for the dedicated Analytics page. `days` sets the trend/KPI
   * window (the KPI strip compares it against the immediately preceding window
   * of equal length). Breakdowns (top products/brands/sizes/locations, brand
   * profit, top customers, channel split) are all-time; stock alerts and
   * receivables aging reflect the current state.
   */
  async insights(days: number) {
    const windowDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
    const now = new Date();
    const { keys: trendKeys, since: currentStart } = istRecentDays(now, windowDays);
    const previousStart = new Date(currentStart.getTime() - windowDays * DAY_MS);
    const deadSince = new Date(now.getTime() - DEAD_STOCK_DAYS * DAY_MS);

    const [
      windowOrders,
      items,
      locationGroup,
      pendingOrders,
      lowVariants,
      productsWithStock,
      soldRecently,
      customerGroup,
      channelGroup,
    ] = await Promise.all([
      // Orders across the current + previous window, for the trend and KPIs.
      this.prisma.order.findMany({
        where: { ...NOT_REJECTED, createdAt: { gte: previousStart } },
        select: { createdAt: true, total: true, userId: true },
      }),
      // All-time line items — breakdowns + brand profit + period profit.
      this.prisma.orderItem.findMany({
        where: { order: NOT_REJECTED },
        select: {
          productId: true,
          title: true,
          sku: true,
          sizeLabel: true,
          quantity: true,
          unitPrice: true,
          product: { select: { brand: true, inhouseCost: true } },
          order: { select: { createdAt: true } },
        },
      }),
      this.prisma.order.groupBy({
        by: ['city', 'state'],
        where: NOT_REJECTED,
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _count: { city: 'desc' } },
        take: TOP_LOCATIONS,
      }),
      this.prisma.order.findMany({
        where: { status: ORDER_STATUS.APPROVED_PAYMENT_PENDING },
        select: { createdAt: true, total: true },
      }),
      // Variants at/below the low-stock line, freshest concern first.
      this.prisma.productVariant.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { deletedAt: null } },
        select: {
          stock: true,
          size: { select: { label: true } },
          product: { select: { id: true, name: true, brand: true } },
        },
        orderBy: { stock: 'asc' },
        take: STOCK_LIST_LIMIT,
      }),
      // Every live product with its total stock, to find dead stock.
      this.prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, brand: true, variants: { select: { stock: true } } },
      }),
      // Products that sold in the dead-stock window (so we can exclude them).
      this.prisma.orderItem.findMany({
        where: { order: { ...NOT_REJECTED, createdAt: { gte: deadSince } } },
        select: { productId: true },
        distinct: ['productId'],
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: NOT_REJECTED,
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: TOP_CUSTOMERS,
      }),
      this.prisma.order.groupBy({
        by: ['orderType'],
        where: NOT_REJECTED,
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    // ---- Breakdowns + brand profit + period profit from line items --------
    const productMap = new Map<
      string,
      { productId: string; title: string; sku: string; brand: string; units: number; revenue: number }
    >();
    const brandMap = new Map<
      string,
      { brand: string; units: number; revenue: number; profit: number }
    >();
    const sizeMap = new Map<string, { sizeLabel: string; units: number }>();
    const productSizeMap = new Map<string, Map<string, number>>();
    let currentProfit = 0;
    let previousProfit = 0;

    for (const it of items) {
      const cost = it.product?.inhouseCost ?? 0;
      const lineRevenue = it.unitPrice * it.quantity;
      const lineProfit = (it.unitPrice - cost) * it.quantity;
      const created = it.order.createdAt;
      if (created >= currentStart) currentProfit += lineProfit;
      else if (created >= previousStart) previousProfit += lineProfit;

      const brand = it.product?.brand ?? '—';
      const p = productMap.get(it.productId) ?? {
        productId: it.productId,
        title: it.title,
        sku: it.sku,
        brand,
        units: 0,
        revenue: 0,
      };
      p.units += it.quantity;
      p.revenue += lineRevenue;
      productMap.set(it.productId, p);

      const b = brandMap.get(brand) ?? { brand, units: 0, revenue: 0, profit: 0 };
      b.units += it.quantity;
      b.revenue += lineRevenue;
      b.profit += lineProfit;
      brandMap.set(brand, b);

      const label = it.sizeLabel ?? '—';
      const s = sizeMap.get(label) ?? { sizeLabel: label, units: 0 };
      s.units += it.quantity;
      sizeMap.set(label, s);

      const perProduct = productSizeMap.get(it.productId) ?? new Map<string, number>();
      perProduct.set(label, (perProduct.get(label) ?? 0) + it.quantity);
      productSizeMap.set(it.productId, perProduct);
    }

    // ---- Trend (current window, daily) + current/previous KPI totals -------
    const trendBuckets = new Map(trendKeys.map((k) => [k, { orders: 0, revenue: 0 }]));
    let curOrders = 0;
    let curRevenue = 0;
    let prevOrders = 0;
    let prevRevenue = 0;
    const periodUserIds = new Set<string>();
    for (const o of windowOrders) {
      if (o.createdAt >= currentStart) {
        curOrders += 1;
        curRevenue += o.total;
        if (o.userId) periodUserIds.add(o.userId);
        const bucket = trendBuckets.get(istDateKey(o.createdAt));
        if (bucket) {
          bucket.orders += 1;
          bucket.revenue += o.total;
        }
      } else {
        prevOrders += 1;
        prevRevenue += o.total;
      }
    }

    // ---- New vs returning customers (current window) -----------------------
    let returningCount = 0;
    if (periodUserIds.size > 0) {
      const priorBuyers = await this.prisma.order.findMany({
        where: {
          ...NOT_REJECTED,
          userId: { in: [...periodUserIds] },
          createdAt: { lt: currentStart },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      returningCount = priorBuyers.length;
    }
    const periodCustomers = periodUserIds.size;
    const newCustomers = periodCustomers - returningCount;

    // ---- Receivables aging -------------------------------------------------
    const aging = [
      { bucket: '0-7', label: '0–7 days', orders: 0, amount: 0 },
      { bucket: '8-30', label: '8–30 days', orders: 0, amount: 0 },
      { bucket: '31+', label: '31+ days', orders: 0, amount: 0 },
    ];
    for (const o of pendingOrders) {
      const ageDays = (now.getTime() - o.createdAt.getTime()) / DAY_MS;
      const slot = ageDays <= 7 ? aging[0]! : ageDays <= 30 ? aging[1]! : aging[2]!;
      slot.orders += 1;
      slot.amount += o.total;
    }

    // ---- Low / out-of-stock ------------------------------------------------
    const lowStock = lowVariants.map((v) => ({
      productId: v.product.id,
      title: v.product.name,
      brand: v.product.brand,
      sizeLabel: v.size.label,
      stock: v.stock,
    }));
    const outOfStockCount = lowStock.filter((v) => v.stock <= 0).length;
    const lowStockCount = lowStock.length - outOfStockCount;

    // ---- Dead stock: has stock, no sales in the window ---------------------
    const soldIds = new Set(soldRecently.map((r) => r.productId));
    const deadStock = productsWithStock
      .map((p) => ({
        productId: p.id,
        title: p.name,
        brand: p.brand,
        stock: p.variants.reduce((n, v) => n + v.stock, 0),
      }))
      .filter((p) => p.stock > 0 && !soldIds.has(p.productId))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, DEAD_STOCK_LIMIT);

    // ---- Top customers (login users only; credit-customer orders excluded) --
    const userCustomerGroup = customerGroup.filter(
      (g): g is typeof g & { userId: string } => g.userId !== null,
    );
    const customerNames = await this.prisma.user.findMany({
      where: { id: { in: userCustomerGroup.map((g) => g.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(customerNames.map((u) => [u.id, u.name]));
    const topCustomers = userCustomerGroup.map((g) => ({
      userId: g.userId,
      name: nameById.get(g.userId) ?? 'Unknown',
      orders: g._count._all,
      spend: g._sum.total ?? 0,
    }));

    return {
      rangeDays: windowDays,
      period: {
        current: { orders: curOrders, revenue: curRevenue, profit: Math.round(currentProfit) },
        previous: { orders: prevOrders, revenue: prevRevenue, profit: Math.round(previousProfit) },
      },
      customers: {
        active: periodCustomers,
        new: newCustomers,
        returning: returningCount,
        repeatRate: periodCustomers > 0 ? returningCount / periodCustomers : 0,
      },
      trend: trendKeys.map((date) => ({
        date,
        orders: trendBuckets.get(date)!.orders,
        revenue: trendBuckets.get(date)!.revenue,
      })),
      topProducts: [...productMap.values()].sort((a, b) => b.units - a.units).slice(0, TOP_PRODUCTS),
      topBrands: [...brandMap.values()].sort((a, b) => b.units - a.units).slice(0, TOP_BRANDS),
      profitByBrand: [...brandMap.values()]
        .map((b) => ({ brand: b.brand, profit: Math.round(b.profit), revenue: b.revenue }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, TOP_BRANDS),
      sizes: [...sizeMap.values()].sort((a, b) => b.units - a.units).slice(0, TOP_SIZES),
      sizesByProduct: [...productSizeMap.entries()]
        .map(([productId, sizes]) => ({
          productId,
          title: productMap.get(productId)?.title ?? '—',
          units: productMap.get(productId)?.units ?? 0,
          sizes: [...sizes.entries()]
            .map(([sizeLabel, units]) => ({ sizeLabel, units }))
            .sort((a, b) => b.units - a.units),
        }))
        .sort((a, b) => b.units - a.units),
      locations: locationGroup.map((g) => ({
        city: g.city,
        state: g.state,
        orders: g._count._all,
        revenue: g._sum.total ?? 0,
      })),
      channel: channelGroup.map((g) => ({
        type: g.orderType,
        orders: g._count._all,
        revenue: g._sum.total ?? 0,
      })),
      topCustomers,
      receivablesAging: aging,
      stock: {
        outOfStockCount,
        lowStockCount,
        low: lowStock,
        dead: deadStock,
      },
    };
  }
}
