import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEvent, AuditModule, OrderType, Prisma, ShipmentStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CourierConfigService } from '../courier-config/courier-config.service';
import { CombinationsService } from '../dimensions/combinations.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  ShipmozoService,
  type ShipmozoProductDetail,
  type ShipmozoPushOrderPayload,
  type ShipmozoRateCalculatorPayload,
} from './shipmozo.service';

/** Order + line items + each item's product dimension — everything a push needs. */
const orderPushInclude = {
  items: {
    include: { product: { include: { dimension: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderInclude;

type OrderForPush = Prisma.OrderGetPayload<{ include: typeof orderPushInclude }>;

/**
 * A courier candidate for auto-assignment: an admin-configured courier for the
 * order's weight slab that the rate calculator confirmed is available on this
 * route. Assignment is attempted in the admin's priority order (index 0 first),
 * falling through to the next on failure — so this is always an ordered list.
 */
type SelectedCourier = {
  weightSlab: string;
  courierCompanyId: string;
  courierCompanyServiceTypeId: string;
  label: string | null;
};

/**
 * Fallback shipment box for multi-unit orders: the "Extra large (Multiple shoes)"
 * carton — 5 kg, 20 × 30 × 40 cm. Used whenever an order has MORE than 4 units,
 * or has 2–4 units with no exactly-matching Dimension Combination. Weight is in
 * grams to match the Shipmozo payload.
 */
const EXTRA_LARGE_BOX = { weight: 5000, length: 20, width: 30, height: 40 } as const;

/** The order columns that describe its Shipmozo shipment. */
const shipmentSelect = {
  shipmentStatus: true,
  shipmozoOrderId: true,
  shipmozoReferenceId: true,
  courierPartner: true,
  trackingId: true,
  shipmentError: true,
  shipmentPushedAt: true,
} as const;

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipmozo: ShipmozoService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly combinations: CombinationsService,
    private readonly courierConfigs: CourierConfigService,
  ) {}

  /** Warehouse id from env — supports the misspelled key that ships in .env. */
  private envWarehouseId(): string {
    return (
      this.config.get<string>('SHIPMOZO_WEARHOUSE_ID')?.trim() ||
      this.config.get<string>('SHIPMOZO_WAREHOUSE_ID')?.trim() ||
      ''
    );
  }

  /**
   * Push an order to the Shipmozo panel and persist the outcome on the order.
   * Never throws for expected failures (bad response, not configured): the
   * error is stored on the order and the updated shipment fields are returned,
   * so order creation is never blocked by a courier-side problem.
   */
  async pushForOrder(orderId: string, auditedBy?: string, force = false) {
    this.logger.debug(`[SHIPMOZO DEBUG] pushForOrder START orderId=${orderId} force=${force}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderPushInclude,
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    this.logger.debug(
      `[SHIPMOZO DEBUG] order loaded: ${order.orderNumber} currentShipmentStatus=${order.shipmentStatus} items=${order.items.length}`,
    );

    // The whole flow is admin-controlled from Settings. When Shipmozo is
    // disabled, the order lives only in our system — no push, no failure.
    const settings = await this.settings.getShipmozo();
    this.logger.debug(
      `[SHIPMOZO DEBUG] settings: enabled=${settings.enabled} warehouseId="${settings.warehouseId}"`,
    );
    if (!settings.enabled) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] STOP — Shipmozo disabled in settings for ${order.orderNumber}`,
      );
      this.logger.log(`Shipmozo disabled in settings — skipping push for ${order.orderNumber}`);
      return this.pickShipment(order);
    }

    // Bulk orders are shipped manually (no Shipmozo). The admin creates the
    // shipment in the Shipmozo panel by hand and attaches it, so never auto-push.
    if (order.orderType === OrderType.BULK) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] STOP — order ${order.orderNumber} is BULK (manual shipping, no Shipmozo push)`,
      );
      return this.pickShipment(order);
    }

    // Per-state skip list: orders shipping to an admin-configured state are
    // created in our system only — never pushed to Shipmozo. Case/whitespace
    // insensitive so "Goa", "goa " and "GOA" all match.
    const orderState = order.state?.trim().toLowerCase() ?? '';
    const skipState = (settings.skipStates ?? []).some(
      (s) => s.trim().toLowerCase() === orderState,
    );
    if (skipState) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] STOP — state "${order.state}" is in the Shipmozo skip list for ${order.orderNumber}`,
      );
      this.logger.log(
        `Order ${order.orderNumber} ships to "${order.state}" (skip list) — not pushing to Shipmozo`,
      );
      return this.pickShipment(order);
    }

    // Idempotency: never re-push an order that already lives in the Shipmozo
    // panel unless explicitly forced (a deliberate admin retry). Prevents the
    // auto-push and any accidental double-submit from creating duplicates.
    if (
      !force &&
      (order.shipmentStatus === ShipmentStatus.PUSHED ||
        order.shipmentStatus === ShipmentStatus.ASSIGNED)
    ) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] STOP — order ${order.orderNumber} already ${order.shipmentStatus} and force=false (idempotency skip).`,
      );
      return this.pickShipment(order);
    }

    if (!this.shipmozo.isConfigured()) {
      this.logger.debug(`[SHIPMOZO DEBUG] STOP — Shipmozo not configured (missing API keys)`);
      return this.recordFailure(
        orderId,
        'Shipmozo is not configured (missing API keys).',
        auditedBy,
      );
    }

    const warehouseId = settings.warehouseId?.trim() || this.envWarehouseId();

    try {
      // Resolve weight/box (single → dimension, multiple → combination) and
      // build the payload inside the try so any error is recorded as a shipment
      // failure rather than thrown to the caller.
      const resolved = await this.resolveShipment(order);
      this.logger.debug(
        `[SHIPMOZO DEBUG] resolveShipment: totalUnits=${resolved.totalUnits} weight=${resolved.weight}g box=${resolved.length}x${resolved.width}x${resolved.height} note=${resolved.note ?? 'none'}`,
      );
      if (resolved.note) {
        this.logger.warn(`Order ${order.orderNumber}: ${resolved.note}`);
      }
      const payload = this.buildPayload(order, warehouseId, resolved);

      // Auto-assign is only for small orders (≤ 4 units). Orders over 4 units
      // ship in the Extra Large box and are handled/assigned manually, so we
      // never auto-book a courier for them even when the admin has auto-assign
      // on — they push and stay PUSHED for a person to assign.
      const autoAssign = settings.autoAssignCourier && resolved.totalUnits <= 4;

      // Rate Calculator is the serviceability and courier-policy gate. It
      // returns live available services; choose only an admin-configured
      // courier for the appropriate order-weight slab before creating the
      // remote Shipmozo order. A configured courier is only *required* when
      // we're going to auto-assign (we need one to assign); otherwise we just
      // need the route to be serviceable, so a missing courier mapping must not
      // fail an order the admin only intends to push.
      const selectedCouriers = await this.selectConfiguredCouriers(order, resolved, autoAssign);

      this.logger.debug(`[SHIPMOZO DEBUG] calling push-order for ${order.orderNumber}...`);
      const res = await this.shipmozo.pushOrder(payload);
      this.logger.debug(
        `[SHIPMOZO DEBUG] push-order OK: shipmozoOrderId=${res.data.order_id ?? 'null'} referenceId=${res.data.reference_id ?? 'null'}`,
      );
      const pushed = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shipmentStatus: ShipmentStatus.PUSHED,
          shipmozoOrderId: res.data.order_id ?? null,
          shipmozoReferenceId: res.data.reference_id ?? null,
          shipmentError: null,
          shipmentPushedAt: new Date(),
        },
        select: shipmentSelect,
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.CREATION,
        moduleId: order.id,
        referenceNumber: order.orderNumber,
        action: `Order ${order.orderNumber} pushed to Shipmozo (id ${res.data.order_id ?? '?'})`,
        formData: {
          request: payload,
          selectedCouriers,
          response: res,
          resolvedNote: resolved.note ?? null,
          // Origin used for the serviceability check vs. the ship-from warehouse.
          // These are separate settings; logging both makes any drift diagnosable.
          origin: { pickupPincode: this.pickupPincode(), warehouseId },
        },
        auditedBy,
      });

      // Auto-assign only when it's enabled for this order (admin setting on AND
      // ≤ 4 units) AND at least one configured courier is available on the route.
      // (Otherwise selectedCouriers is empty — the route was serviceable but no
      // courier mapping was required.)
      if (!autoAssign || selectedCouriers.length === 0) {
        const reason = !settings.autoAssignCourier
          ? 'is OFF'
          : resolved.totalUnits > 4
            ? `skipped (${resolved.totalUnits} units > 4 — manual assignment)`
            : 'ON but no configured courier';
        this.logger.debug(
          `[SHIPMOZO DEBUG] auto-assign ${reason} — order ${order.orderNumber} stays PUSHED (no courier assignment)`,
        );
        return pushed;
      }
      return this.tryAssignConfiguredCouriers(
        orderId,
        order.orderNumber,
        res.data.order_id ?? null,
        selectedCouriers,
        auditedBy,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `[SHIPMOZO DEBUG] EXCEPTION in push flow for ${order.orderNumber}: ${message} — recording FAILED`,
      );
      this.logger.error(`Push to Shipmozo failed for ${order.orderNumber}: ${message}`);
      const failed = await this.recordFailure(orderId, message, auditedBy, order.orderNumber);
      // These are expected business gates (non-serviceable route or no approved
      // courier), so surface them as a clear 400 to a manual push caller as
      // well as persisting the failure for background order creation.
      if (error instanceof BadRequestException) throw error;
      return failed;
    }
  }

  /**
   * Retry courier assignment for an order that is ALREADY in the Shipmozo panel
   * — a prior push succeeded but every configured courier failed to assign (e.g.
   * each rejected the pincode at assign time), or an admin wants another attempt.
   *
   * Unlike a forced push this NEVER calls push-order again: it reuses the
   * existing Shipmozo order id, so it can't create a duplicate remote order. It
   * re-runs the rate calculator for a fresh candidate list, then walks it in the
   * admin's priority order, stopping on the first success.
   */
  async retryAssignForOrder(orderId: string, auditedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderPushInclude,
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (!this.shipmozo.isConfigured()) {
      throw new ServiceUnavailableException('Shipmozo is not configured (missing API keys).');
    }

    // This path only (re)assigns a courier — it never pushes. The order must
    // already live in the Shipmozo panel; if it was never pushed, the admin
    // should push it first (which also attempts assignment).
    if (!order.shipmozoOrderId) {
      throw new BadRequestException(
        `Order ${order.orderNumber} has not been pushed to Shipmozo yet — push it first.`,
      );
    }

    // Already has a courier + tracking: re-assigning risks booking a second
    // shipment. Block it — drop the shipment first if a change is really needed.
    if (order.shipmentStatus === ShipmentStatus.ASSIGNED) {
      throw new BadRequestException(
        `Order ${order.orderNumber} already has a courier assigned. Drop the shipment first to reassign.`,
      );
    }

    try {
      const resolved = await this.resolveShipment(order);
      // requireConfiguredCourier = true: an explicit assign request needs a usable
      // courier for the route/slab, else there is nothing to assign.
      const selectedCouriers = await this.selectConfiguredCouriers(order, resolved, true);
      this.logger.debug(
        `[SHIPMOZO DEBUG] retryAssign order=${order.orderNumber} reusing shipmozoOrderId=${order.shipmozoOrderId} candidates=${selectedCouriers.length}`,
      );
      return await this.tryAssignConfiguredCouriers(
        orderId,
        order.orderNumber,
        order.shipmozoOrderId,
        selectedCouriers,
        auditedBy,
      );
    } catch (error) {
      // Only errors thrown BEFORE the assign loop land here (resolve / rate-calc /
      // no configured courier). The loop itself never throws — it records its own
      // per-courier failures and returns.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Retry courier assignment failed for ${order.orderNumber}: ${message}`);
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { shipmentError: `Courier assignment retry failed: ${message}` },
        select: shipmentSelect,
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: orderId,
        referenceNumber: order.orderNumber,
        action: `Courier assignment retry failed for order ${order.orderNumber}`,
        formData: { error: message },
        auditedBy,
      });
      // Business gates (non-serviceable route / no configured courier) → clear 400.
      if (error instanceof BadRequestException) throw error;
      return updated;
    }
  }

  /**
   * Manually mark an order as shipped with a locally-arranged courier — no
   * Shipmozo push involved. Stores the courier name + AWB and moves the order to
   * ASSIGNED (the "has courier + tracking" terminal state), stamping the ship
   * time and clearing any prior error. Used for orders fulfilled by our own
   * local courier (e.g. Tirupati) instead of the aggregator.
   */
  async markManualShipment(
    orderId: string,
    courierPartner: string,
    trackingId: string,
    auditedBy?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shipmentStatus: ShipmentStatus.ASSIGNED,
        courierPartner: courierPartner.trim(),
        trackingId: trackingId.trim(),
        shipmentError: null,
        shipmentPushedAt: new Date(),
      },
      select: shipmentSelect,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: orderId,
      referenceNumber: order.orderNumber,
      action: `Order ${order.orderNumber} marked shipped manually via "${courierPartner.trim()}" (AWB ${trackingId.trim()})`,
      formData: { courierPartner: courierPartner.trim(), trackingId: trackingId.trim() },
      auditedBy,
    });
    return updated;
  }

  /**
   * Attach an existing Shipmozo order (created manually in the Shipmozo panel)
   * to our order by its Shipmozo order id. Validates the id by fetching the
   * order from Shipmozo — a success response means the order really exists, so
   * we treat it as shipped and copy across whatever tracking details Shipmozo
   * returns (courier + AWB + reference id). Throws (BadGateway) when the id is
   * unknown to Shipmozo, so nothing is persisted on a bad id.
   */
  async attachShipmozoOrder(orderId: string, shipmozoOrderId: string, auditedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, pincode: true, addressMobileNo: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (!this.shipmozo.isConfigured()) {
      throw new ServiceUnavailableException('Shipmozo is not configured (missing API keys).');
    }

    const id = shipmozoOrderId.trim();
    // Validates the id — throws if Shipmozo doesn't recognise it.
    const res = await this.shipmozo.getOrderDetail(id);

    // Guard against attaching the WRONG Shipmozo order: the fetched order must
    // be for the same customer as ours. We match on delivery pincode + mobile
    // number — the Shipmozo response shape varies, so rather than guess field
    // names we scan every value in the payload for our order's digits.
    const ourPincode = order.pincode.replace(/\D/g, '');
    const ourMobile = order.addressMobileNo.replace(/\D/g, '').slice(-10);
    const digitValues = collectDigitStrings(res.data);
    const pincodeMatches = ourPincode.length > 0 && digitValues.some((v) => v.includes(ourPincode));
    // 10-digit compare tolerates a country-code prefix on the Shipmozo side.
    const mobileMatches =
      ourMobile.length === 10 &&
      digitValues.some((v) => v.slice(-10) === ourMobile || v.includes(ourMobile));
    if (!pincodeMatches || !mobileMatches) {
      const mismatched = [
        !pincodeMatches ? 'pincode' : null,
        !mobileMatches ? 'mobile number' : null,
      ]
        .filter(Boolean)
        .join(' and ');
      throw new BadRequestException(
        `Shipmozo order ${id} does not match this order's ${mismatched}. Attach cancelled.`,
      );
    }

    // Shipmozo's detail payload can be an object or a single-element array;
    // normalise, then pick whichever key spelling carries the courier / AWB.
    const { courier, awb, referenceId } = extractCourierAwb(res.data);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shipmentStatus: ShipmentStatus.ASSIGNED,
        shipmozoOrderId: id,
        shipmozoReferenceId: referenceId,
        courierPartner: courier,
        trackingId: awb,
        shipmentError: null,
        shipmentPushedAt: new Date(),
      },
      select: shipmentSelect,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: orderId,
      referenceNumber: order.orderNumber,
      action: `Shipmozo order ${id} attached to order ${order.orderNumber} (courier "${courier ?? '?'}", AWB ${awb ?? '?'})`,
      formData: { response: res },
      auditedBy,
    });
    return updated;
  }

  /**
   * Drop a manual shipment: revert the order to NOT_SHIPPED and wipe every
   * shipment detail (courier, AWB, ship time, error, Shipmozo ids) so it's back
   * to its original, unshipped state. Used to undo a manual "mark as shipped".
   */
  async dropShipment(orderId: string, auditedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shipmentStatus: ShipmentStatus.NOT_SHIPPED,
        courierPartner: null,
        trackingId: null,
        shipmentError: null,
        shipmentPushedAt: null,
        shipmozoOrderId: null,
        shipmozoReferenceId: null,
      },
      select: shipmentSelect,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: orderId,
      referenceNumber: order.orderNumber,
      action: `Shipment dropped for order ${order.orderNumber} — reverted to not shipped`,
      auditedBy,
    });
    return updated;
  }

  /**
   * Cancel an order in the Shipmozo panel to keep it in sync when the order is
   * cancelled (rejected) or deleted on our side. Only acts when the order was
   * actually pushed (status PUSHED or ASSIGNED) and has a Shipmozo order id —
   * otherwise there's nothing to cancel there.
   *
   * Never throws — a courier-side failure must not block the local cancel or
   * delete. `persist` writes CANCELLED back onto the order; pass false when the
   * order row is about to be deleted (there's nothing left to update).
   */
  async cancelForOrder(orderId: string, auditedBy?: string, persist = true) {
    this.logger.debug(
      `[SHIPMOZO DEBUG] cancelForOrder START orderId=${orderId} persist=${persist}`,
    );
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        shipmentStatus: true,
        shipmozoOrderId: true,
        trackingId: true,
      },
    });
    if (!order) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] cancelForOrder — order ${orderId} not found, nothing to cancel`,
      );
      return;
    }

    const active =
      order.shipmentStatus === ShipmentStatus.PUSHED ||
      order.shipmentStatus === ShipmentStatus.ASSIGNED;
    if (!active || !order.shipmozoOrderId) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] cancel SKIP ${order.orderNumber}: status=${order.shipmentStatus} shipmozoOrderId=${order.shipmozoOrderId ?? 'null'} — not present in Shipmozo`,
      );
      return;
    }
    if (!this.shipmozo.isConfigured()) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] cancel SKIP ${order.orderNumber}: Shipmozo not configured`,
      );
      return;
    }

    try {
      this.logger.debug(
        `[SHIPMOZO DEBUG] cancelling ${order.orderNumber} in Shipmozo (shipmozoOrderId=${order.shipmozoOrderId} awb=${order.trackingId ?? 'null'})`,
      );
      const res = await this.shipmozo.cancelOrder(order.shipmozoOrderId, order.trackingId);
      if (persist) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { shipmentStatus: ShipmentStatus.CANCELLED, shipmentError: null },
        });
      }
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: orderId,
        referenceNumber: order.orderNumber,
        action: `Order ${order.orderNumber} cancelled in Shipmozo`,
        formData: { response: res },
        auditedBy,
      });
      this.logger.debug(`[SHIPMOZO DEBUG] cancel OK for ${order.orderNumber}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`[SHIPMOZO DEBUG] cancel FAILED for ${order.orderNumber}: ${message}`);
      this.logger.error(`Shipmozo cancel failed for ${order.orderNumber}: ${message}`);
      if (persist) {
        await this.prisma.order
          .update({
            where: { id: orderId },
            data: { shipmentError: `Shipmozo cancel failed: ${message}` },
          })
          .catch(() => undefined);
      }
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: orderId,
        referenceNumber: order.orderNumber,
        action: `Shipmozo cancel failed for order ${order.orderNumber}`,
        formData: { error: message },
        auditedBy,
      });
    }
  }

  /** Configured warehouse pickup pincode (as a number), or null if unset/invalid. */
  private pickupPincode(): number | null {
    const raw = this.config.get<string>('SHIPMOZO_PICKUP_PINCODE')?.trim();
    const digits = raw?.replace(/\D/g, '');
    const parsed = digits ? Number(digits) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  /**
   * Rate calculation is both the serviceability check and courier-policy gate.
   * `requireConfiguredCourier` controls the second half: when true (auto-assign
   * on) a matching admin-configured courier for the weight slab is mandatory and
   * its absence fails the push; when false (auto-assign off) a serviceable route
   * is enough and the method returns `null` if no courier is configured.
   *
   * NOTE: serviceability is checked from SHIPMOZO_PICKUP_PINCODE while the push
   * ships from the (separate) warehouse_id. These are independent settings — if
   * they describe different origins the availability check is meaningless. Keep
   * SHIPMOZO_PICKUP_PINCODE equal to the warehouse's pincode.
   */
  private async selectConfiguredCouriers(
    order: OrderForPush,
    box: { weight: number; length: number; width: number; height: number },
    requireConfiguredCourier: boolean,
  ): Promise<SelectedCourier[]> {
    const pickup = this.pickupPincode();
    const deliveryDigits = order.pincode.replace(/\D/g, '');
    const delivery = deliveryDigits ? Number(deliveryDigits) : NaN;

    if (!pickup) {
      throw new ServiceUnavailableException(
        'SHIPMOZO_PICKUP_PINCODE is not configured; courier availability cannot be checked.',
      );
    }
    if (!Number.isFinite(delivery) || delivery <= 0) {
      throw new BadRequestException(
        `Order ${order.orderNumber} has no valid delivery pincode for courier availability.`,
      );
    }

    const payload: ShipmozoRateCalculatorPayload = {
      order_id: '',
      pickup_pincode: pickup,
      delivery_pincode: delivery,
      payment_type: 'PREPAID',
      shipment_type: 'FORWARD',
      order_amount: order.total,
      type_of_package: 'SPS',
      rov_type: 'ROV_OWNER',
      cod_amount: '',
      weight: box.weight,
      dimensions: [
        {
          no_of_box: '1',
          length: String(box.length),
          width: String(box.width),
          height: String(box.height),
        },
      ],
    };

    const res = await this.shipmozo.rateCalculator(payload);
    const couriers = Array.isArray(res.data) ? res.data : [];
    if (couriers.length === 0) {
      throw new BadRequestException(
        `Delivery pincode ${delivery} is not serviceable from pickup pincode ${pickup}.`,
      );
    }
    // Collect EVERY service-type id the rate calculator reports as available on
    // this route. Matching is on the service type ID: a courier option's `id`
    // must equal a configured `courierCompanyServiceTypeId`.
    const availableIds = new Set(
      couriers.map((courier) => getCourierId(courier, ['id'])).filter((id): id is string => !!id),
    );
    const weightSlab = weightSlabForGrams(box.weight);
    const configured = await this.courierConfigs.findByWeightSlab(weightSlab);
    // Keep only the configured couriers this route actually offers, preserving
    // the admin's priority order (findByWeightSlab returns priority-asc). This
    // is the ordered fallback list assignment walks through. IDs are trimmed on
    // both sides so a stray space in a config value can't silently miss a match,
    // and a duplicated config row can't queue the same courier twice.
    const seen = new Set<string>();
    const candidates: SelectedCourier[] = [];
    for (const config of configured) {
      const serviceTypeId = config.courierCompanyServiceTypeId.trim();
      if (!availableIds.has(serviceTypeId) || seen.has(serviceTypeId)) continue;
      seen.add(serviceTypeId);
      candidates.push({
        weightSlab: config.weightSlab,
        courierCompanyId: config.courierCompanyId.trim(),
        courierCompanyServiceTypeId: serviceTypeId,
        label: config.label,
      });
    }
    this.logger.debug(
      `[SHIPMOZO DEBUG] rate-calculator: ${couriers.length} service(s) available [${[...availableIds].join(', ') || 'none'}]; ` +
        `${configured.length} configured for ${weightSlab} slab; ` +
        `${candidates.length} usable candidate(s) in priority order: ` +
        `${candidates.map((c) => c.label ?? c.courierCompanyServiceTypeId).join(' > ') || 'none'}`,
    );
    if (candidates.length === 0) {
      // Auto-assign needs at least one courier to book; without one the push must fail.
      if (requireConfiguredCourier) {
        throw new BadRequestException(
          `Standard courier is not available for the ${weightSlab} slab on this route.`,
        );
      }
      // Auto-assign off: the route is serviceable, which is all we require.
      // Push proceeds; courier gets assigned later (manually or on a forced push).
      this.logger.debug(
        `[SHIPMOZO DEBUG] no configured courier for ${weightSlab} slab on this route, but auto-assign is off — pushing without a courier`,
      );
      return [];
    }
    return candidates;
  }

  /**
   * Assign a courier after a successful push, trying each configured candidate
   * in the admin's priority order until one succeeds.
   *
   * The rate calculator can report a route as serviceable while a *specific*
   * courier still rejects it at assign time (e.g. "<pincode> is non serviceable
   * pincode"), so a single courier is not enough. Each assign failure is a
   * `result:"0"` from Shipmozo — nothing was booked — so falling through to the
   * next candidate is safe; we only stop on the first genuine success. If every
   * candidate fails the order stays PUSHED with the per-courier errors recorded,
   * ready for a manual retry.
   */
  private async tryAssignConfiguredCouriers(
    orderId: string,
    orderNumber: string,
    shipmozoOrderId: string | null,
    selectedCouriers: SelectedCourier[],
    auditedBy?: string,
  ) {
    this.logger.debug(
      `[SHIPMOZO DEBUG] assign configured courier START order=${orderNumber} shipmozoOrderId=${shipmozoOrderId ?? 'null'} candidates=${selectedCouriers.length}`,
    );
    if (!shipmozoOrderId) {
      return this.prisma.order.update({
        where: { id: orderId },
        data: { shipmentError: 'Courier assignment skipped: Shipmozo push returned no order ID.' },
        select: shipmentSelect,
      });
    }

    // Every failed attempt is recorded so a total failure explains what was tried.
    const attempts: Array<{ courier: string; courierId: string; error: string }> = [];

    for (const [i, candidate] of selectedCouriers.entries()) {
      const courierLabel = candidate.label ?? candidate.courierCompanyServiceTypeId;
      this.logger.debug(
        `[SHIPMOZO DEBUG] assign attempt ${i + 1}/${selectedCouriers.length} order=${orderNumber} ` +
          `courier_id=${candidate.courierCompanyServiceTypeId} (${courierLabel}) → ${shipmozoOrderId}`,
      );

      try {
        const res = await this.shipmozo.assignCourier(
          shipmozoOrderId,
          candidate.courierCompanyServiceTypeId,
        );
        this.logger.debug(
          `[SHIPMOZO DEBUG] assign-courier OK on attempt ${i + 1}: ` +
            `courier=${res.data.courier_company ?? courierLabel} awb=${res.data.awb_number ?? 'null'}`,
        );

        // Assign occasionally returns success before the AWB is allocated. Rather
        // than persist ASSIGNED with no tracking id, fetch the order detail once
        // to pick up the AWB (and courier name) the panel has by now. Read-only,
        // so a failure here is non-fatal — we just fall back to the assign body.
        let courierPartner =
          res.data.courier_company ?? candidate.label ?? candidate.courierCompanyId;
        let awb = res.data.awb_number ?? null;
        if (!awb) {
          try {
            const detail = await this.shipmozo.getOrderDetail(shipmozoOrderId);
            const extracted = extractCourierAwb(detail.data);
            awb = extracted.awb ?? awb;
            courierPartner = extracted.courier ?? courierPartner;
            this.logger.debug(
              `[SHIPMOZO DEBUG] assign returned no AWB — get-order-detail fallback awb=${awb ?? 'still null'}`,
            );
          } catch (detailError) {
            const message =
              detailError instanceof Error ? detailError.message : String(detailError);
            this.logger.warn(
              `AWB follow-up (get-order-detail) failed for ${orderNumber}: ${message}`,
            );
          }
        }

        const updated = await this.prisma.order.update({
          where: { id: orderId },
          data: {
            shipmentStatus: ShipmentStatus.ASSIGNED,
            courierPartner,
            trackingId: awb,
            shipmentError: null,
          },
          select: shipmentSelect,
        });
        this.audit.log({
          module: AuditModule.SHIPMENTS,
          event: AuditEvent.UPDATION,
          moduleId: orderId,
          referenceNumber: orderNumber,
          action:
            `Configured courier assigned to order ${orderNumber} via "${courierPartner}" ` +
            `on attempt ${i + 1}/${selectedCouriers.length} (AWB ${res.data.awb_number ?? awb ?? '?'})`,
          formData: { selectedCourier: candidate, attempt: i + 1, priorFailures: attempts, response: res },
          auditedBy,
        });
        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({
          courier: courierLabel,
          courierId: candidate.courierCompanyServiceTypeId,
          error: message,
        });
        this.logger.warn(
          `Courier assign attempt ${i + 1}/${selectedCouriers.length} failed for ${orderNumber} ` +
            `via "${courierLabel}": ${message}`,
        );
        // Fall through to the next configured courier (if any).
      }
    }

    // Every candidate failed — keep the order PUSHED and record why each failed
    // so an admin can retry or fix the courier configuration.
    const summary = attempts.map((a) => `${a.courier}: ${a.error}`).join(' | ');
    this.logger.error(
      `All ${selectedCouriers.length} configured courier(s) failed to assign for ${orderNumber}: ${summary}`,
    );
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shipmentError: `Courier assignment failed after ${selectedCouriers.length} attempt(s): ${summary}`,
      },
      select: shipmentSelect,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: orderId,
      referenceNumber: orderNumber,
      action: `Configured courier assignment failed for order ${orderNumber} after trying ${selectedCouriers.length} courier(s)`,
      formData: { attempts },
      auditedBy,
    });
    return updated;
  }

  /** Project a loaded order onto the shipment-fields shape (matches shipmentSelect). */
  private pickShipment(order: OrderForPush) {
    return {
      shipmentStatus: order.shipmentStatus,
      shipmozoOrderId: order.shipmozoOrderId,
      shipmozoReferenceId: order.shipmozoReferenceId,
      courierPartner: order.courierPartner,
      trackingId: order.trackingId,
      shipmentError: order.shipmentError,
      shipmentPushedAt: order.shipmentPushedAt,
    };
  }

  private async recordFailure(
    orderId: string,
    message: string,
    auditedBy?: string,
    orderNumber?: string,
  ) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { shipmentStatus: ShipmentStatus.FAILED, shipmentError: message },
      select: shipmentSelect,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: orderId,
      referenceNumber: orderNumber,
      action: `Shipmozo push failed for order ${orderNumber ?? orderId}`,
      formData: { error: message },
      auditedBy,
    });
    return updated;
  }

  /**
   * Resolve the shipment weight (grams) + box (cm) for an order:
   *  - Every ordered product must have a dimension with a weight, else we refuse.
   *  - Single unit → that product's own dimension (weight + box).
   *  - 2–4 units → the Dimension Combination whose recipe EXACTLY matches the
   *    order's dimension basket (weight + the combination's box). If none
   *    matches, fall back to the Extra Large box (5 kg · 20×30×40).
   *  - More than 4 units → always the Extra Large box; combinations don't apply.
   * Also returns `totalUnits` so the caller can gate auto courier-assignment.
   */
  private async resolveShipment(order: OrderForPush) {
    const missing = order.items.filter(
      (i) => !i.product.dimension || i.product.dimension.weight <= 0,
    );
    if (missing.length > 0) {
      const names = [...new Set(missing.map((i) => i.title))].join(', ');
      throw new Error(
        `Cannot compute shipment weight: no dimension weight set for product(s): ${names}. Map a dimension with a weight to each product.`,
      );
    }

    const first = order.items[0];
    if (!first) throw new Error('Order has no items to ship.');

    const totalUnits = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const grams = (kg: number) => Math.round(kg * 1000);

    // Single unit → straight from the product's own dimension.
    if (totalUnits === 1) {
      const d = first.product.dimension!;
      return {
        weight: grams(d.weight),
        length: d.length,
        width: d.width,
        height: d.height,
        totalUnits,
        note: undefined as string | undefined,
      };
    }

    // More than 4 units → no combination applies; always the Extra Large box.
    if (totalUnits > 4) {
      return {
        ...EXTRA_LARGE_BOX,
        totalUnits,
        note: `${totalUnits} units (>4) — using the Extra Large box.`,
      };
    }

    // 2–4 units. Basket: dimensionId → total quantity across the order.
    const basket = new Map<string, number>();
    for (const i of order.items) {
      const id = i.product.dimensionId!;
      basket.set(id, (basket.get(id) ?? 0) + i.quantity);
    }

    // Exact-match an active combination (same dimensions, same counts).
    const combos = await this.combinations.findAll(false);
    const match = combos.find(
      (c) =>
        c.items.length === basket.size &&
        c.items.every((it) => basket.get(it.dimensionId) === it.quantity),
    );
    if (match) {
      const box = match.boxDimension;
      return {
        weight: grams(match.weight),
        length: box.length,
        width: box.width,
        height: box.height,
        totalUnits,
        note: undefined,
      };
    }

    // No matching combination → the Extra Large fallback box.
    return {
      ...EXTRA_LARGE_BOX,
      totalUnits,
      note: 'No matching dimension combination; used the Extra Large box.',
    };
  }

  /** Turn a persisted order into the Shipmozo push-order request body. */
  private buildPayload(
    order: OrderForPush,
    warehouseId: string,
    box: { weight: number; length: number; width: number; height: number },
  ): ShipmozoPushOrderPayload {
    const { weight, length, width, height } = box;

    // Business rule: the courier manifest always declares a single generic line
    // — "shoes", quantity 1, ₹4999 — rather than the real catalogue items/prices.
    // (Shipmozo also reads `discount`/`hsn` without a null-check, so both keys
    // must always be present; empty string is fine.)
    const product_detail: ShipmozoProductDetail[] = [
      {
        name: 'shoes',
        sku_number: order.items[0]?.sku ?? order.orderNumber,
        quantity: 1,
        unit_price: 4999,
        discount: '',
        hsn: '',
        product_category: 'Other',
      },
    ];

    return {
      order_id: order.orderNumber,
      order_date: order.createdAt.toISOString().slice(0, 10),
      order_type: 'ESSENTIALS',
      consignee_name: order.addressName,
      consignee_phone: digitsOr(order.addressMobileNo),
      consignee_alternate_phone: order.addressAltMobileNo
        ? digitsOr(order.addressAltMobileNo)
        : undefined,
      consignee_email: order.addressEmail ?? undefined,
      consignee_address_line_one: order.addressLine1,
      // Shipmozo has no landmark field, so fold our landmark into line two
      // (existing line-two text, then a space, then the landmark).
      consignee_address_line_two:
        [order.addressLine2, order.landmark]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(' ') || undefined,
      consignee_pin_code: digitsOr(order.pincode),
      consignee_city: order.city,
      consignee_state: order.state,
      product_detail,
      payment_type: 'PREPAID',
      cod_amount: '',
      weight,
      length,
      width,
      height,
      warehouse_id: warehouseId,
      gst_ewaybill_number: '',
      gstin_number: '',
    };
  }

  /**
   * Check serviceability from the configured pickup pincode to a delivery
   * pincode via the rate-calculator endpoint. A non-empty `data` courier list
   * means the delivery pincode is serviceable.
   */
  async checkServiceability(deliveryPincode: number) {
    if (!this.shipmozo.isConfigured()) {
      throw new ServiceUnavailableException('Shipmozo is not configured (missing API keys).');
    }
    const pickup = this.pickupPincode();
    if (!pickup) {
      throw new ServiceUnavailableException('SHIPMOZO_PICKUP_PINCODE is not configured.');
    }
    const payload: ShipmozoRateCalculatorPayload = {
      order_id: '',
      pickup_pincode: pickup,
      delivery_pincode: deliveryPincode,
      payment_type: 'PREPAID',
      shipment_type: 'FORWARD',
      order_amount: 0,
      type_of_package: 'SPS',
      rov_type: 'ROV_OWNER',
      cod_amount: '',
      weight: 1000,
      dimensions: [
        {
          no_of_box: '1',
          length: '22',
          width: '10',
          height: '10',
        },
      ],
    };
    return this.shipmozo.rateCalculator(payload);
  }

  /** Passthrough to the Shipmozo health check. */
  async info() {
    if (!this.shipmozo.isConfigured()) {
      throw new ServiceUnavailableException('Shipmozo is not configured (missing API keys).');
    }
    return this.shipmozo.info();
  }
}

/** Return the numeric form of a phone/pincode when it's clean digits, else the raw string. */
function digitsOr(value: string): number | string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 && digits.length <= 15 ? Number(digits) : value;
}

/** Map a shipment's gram weight to the admin's fixed configuration slabs. */
function weightSlabForGrams(weight: number): '1kg' | '2kg' | '5kg' {
  if (weight <= 1000) return '1kg';
  if (weight <= 2000) return '2kg';
  return '5kg';
}

/**
 * Pull the courier name, AWB and reference id out of a Shipmozo detail/assign
 * payload, tolerating both the object and single-element-array shapes and the
 * several key spellings Shipmozo uses. Returns nulls for anything absent.
 */
function extractCourierAwb(data: unknown): {
  courier: string | null;
  awb: string | null;
  referenceId: string | null;
} {
  const raw = Array.isArray(data) ? (data[0] ?? {}) : data;
  const detail = (raw ?? {}) as Record<string, unknown>;
  const asString = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  };
  return {
    courier:
      asString(detail.courier_company) ??
      asString(detail.courier_name) ??
      asString(detail.courier),
    awb: asString(detail.awb_number) ?? asString(detail.tracking_number) ?? asString(detail.awb),
    referenceId: asString(detail.reference_id),
  };
}

/** Read a Shipmozo courier identifier despite its snake/camel case variants. */
function getCourierId(courier: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = courier[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  }
  return null;
}

/**
 * Walk an arbitrary JSON value and collect the digits of every string/number
 * leaf (dropping any that end up empty). Lets us match our order's pincode /
 * mobile against a Shipmozo response without depending on its exact keys.
 */
function collectDigitStrings(value: unknown, out: string[] = []): string[] {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length > 0) out.push(digits);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDigitStrings(item, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectDigitStrings(v, out);
  }
  return out;
}
