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
      `[SHIPMOZO DEBUG] settings: enabled=${settings.enabled} autoAssignCourier=${settings.autoAssignCourier} warehouseId="${settings.warehouseId}"`,
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
        `[SHIPMOZO DEBUG] STOP — order ${order.orderNumber} already ${order.shipmentStatus} and force=false (idempotency skip). NOTE: auto-assign only runs on the SAME call as a fresh push; a re-push here is skipped so assign never fires.`,
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

      // Gate the push on a serviceability check: no point creating an order in
      // the panel if the courier can't deliver to the destination pincode.
      await this.assertServiceable(order);

      this.logger.debug(`[SHIPMOZO DEBUG] calling push-order for ${order.orderNumber}...`);
      const res = await this.shipmozo.pushOrder(payload);
      this.logger.debug(
        `[SHIPMOZO DEBUG] push-order OK: shipmozoOrderId=${res.data.order_id ?? 'null'} referenceId=${res.data.reference_id ?? 'null'}`,
      );
      const updated = await this.prisma.order.update({
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
        formData: { request: payload, response: res, resolvedNote: resolved.note ?? null },
        auditedBy,
      });

      // Courier assignment: allowed only for orders of up to 4 units AND when
      // the admin has enabled auto-assign in Shipmozo settings. Anything larger
      // is pushed to the panel and assigned MANUALLY, so we never auto-call the
      // assign API for it. On success the returned projection carries the newly
      // assigned courier + AWB, so hand it back in place of the just-pushed one.
      this.logger.debug(
        `[SHIPMOZO DEBUG] auto-assign gate: autoAssignCourier=${settings.autoAssignCourier} totalUnits=${resolved.totalUnits} (<=4? ${resolved.totalUnits <= 4}) => willCallAssign=${settings.autoAssignCourier && resolved.totalUnits <= 4}`,
      );
      if (settings.autoAssignCourier && resolved.totalUnits <= 4) {
        this.logger.debug(`[SHIPMOZO DEBUG] ENTERING auto-assign for ${order.orderNumber}`);
        const assigned = await this.tryAutoAssignCourier(
          orderId,
          order.orderNumber,
          res.data.order_id ?? null,
          auditedBy,
        );
        return assigned ?? updated;
      }
      if (settings.autoAssignCourier && resolved.totalUnits > 4) {
        this.logger.debug(
          `[SHIPMOZO DEBUG] SKIP auto-assign — ${resolved.totalUnits} units (>4), manual handling`,
        );
        this.logger.log(
          `Order ${order.orderNumber} has ${resolved.totalUnits} units (>4) — courier assignment left for manual handling.`,
        );
      } else if (!settings.autoAssignCourier) {
        this.logger.debug(
          `[SHIPMOZO DEBUG] SKIP auto-assign — autoAssignCourier is OFF in Shipmozo settings. Turn it on to enable the assign flow.`,
        );
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `[SHIPMOZO DEBUG] EXCEPTION in push flow for ${order.orderNumber}: ${message} — recording FAILED (auto-assign never reached)`,
      );
      this.logger.error(`Push to Shipmozo failed for ${order.orderNumber}: ${message}`);
      return this.recordFailure(orderId, message, auditedBy, order.orderNumber);
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
    const raw = Array.isArray(res.data) ? (res.data[0] ?? {}) : res.data;
    const detail = (raw ?? {}) as Record<string, unknown>;
    const asString = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s.length > 0 ? s : null;
    };
    const courier =
      asString(detail.courier_company) ?? asString(detail.courier_name) ?? asString(detail.courier);
    const awb =
      asString(detail.awb_number) ?? asString(detail.tracking_number) ?? asString(detail.awb);
    const referenceId = asString(detail.reference_id);

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
   * Throw if Shipmozo reports the destination pincode is not serviceable from
   * the configured pickup pincode. Uses the rate-calculator endpoint: a courier
   * list in `data` means the delivery pincode is serviceable. Skips the check
   * (and allows the push) when the pickup pincode or the delivery pincode isn't
   * a usable number, so a missing config never silently blocks every order.
   */
  private async assertServiceable(order: OrderForPush): Promise<void> {
    const pickup = this.pickupPincode();
    const deliveryDigits = order.pincode.replace(/\D/g, '');
    const delivery = deliveryDigits ? Number(deliveryDigits) : NaN;

    if (!pickup) {
      this.logger.warn(
        `SHIPMOZO_PICKUP_PINCODE not configured — skipping serviceability check for ${order.orderNumber}`,
      );
      return;
    }
    if (!Number.isFinite(delivery) || delivery <= 0) {
      this.logger.warn(
        `Order ${order.orderNumber} has no usable delivery pincode — skipping serviceability check`,
      );
      return;
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
      weight: (order.items.reduce((sum, item) => sum + item.quantity, 0) * 1000) as number,
      dimensions: [
        {
          no_of_box: '1',
          length: '22',
          width: '10',
          height: '10',
        },
      ],
    };

    const res = await this.shipmozo.rateCalculator(payload);
    const couriers = Array.isArray(res.data) ? res.data : [];
    if (couriers.length === 0) {
      const message = `Delivery pincode ${delivery} is not serviceable from ${pickup}.`;
      // When enforcement is on, block the push; otherwise log and proceed so a
      // Shipmozo account still activating its couriers doesn't halt all orders.
      if (this.enforceServiceability()) throw new Error(message);
      this.logger.warn(`${message} Pushing anyway (SHIPMOZO_ENFORCE_SERVICEABILITY=false).`);
    }
  }

  /** Whether a not-serviceable result should block the push (default: true). */
  private enforceServiceability(): boolean {
    const raw = this.config.get<string>('SHIPMOZO_ENFORCE_SERVICEABILITY')?.trim().toLowerCase();
    return raw !== 'false' && raw !== '0' && raw !== 'no';
  }

  /**
   * Auto courier-assignment. Runs after a successful push when the admin's
   * "Auto-assign courier" setting is on and the order has ≤ 4 units. Calls the
   * Shipmozo auto-assign-order endpoint, then persists the returned courier +
   * AWB and moves the order to ShipmentStatus.ASSIGNED.
   *
   * Never throws — the push already succeeded, so an assign failure must not
   * undo it: on failure the order stays PUSHED with the reason recorded in
   * `shipmentError`. Returns the fresh shipment projection (assigned or the
   * failure-annotated one), or null when there's nothing to call.
   */
  private async tryAutoAssignCourier(
    orderId: string,
    orderNumber: string,
    shipmozoOrderId: string | null,
    auditedBy?: string,
  ) {
    this.logger.debug(
      `[SHIPMOZO DEBUG] tryAutoAssignCourier START order=${orderNumber} shipmozoOrderId=${shipmozoOrderId ?? 'null'}`,
    );
    if (!shipmozoOrderId) {
      this.logger.debug(
        `[SHIPMOZO DEBUG] STOP auto-assign — push returned NO Shipmozo order id, cannot call auto-assign-order`,
      );
      this.logger.warn(
        `Cannot auto-assign courier for ${orderNumber}: push returned no Shipmozo order id.`,
      );
      return null;
    }

    try {
      this.logger.debug(
        `[SHIPMOZO DEBUG] calling auto-assign-order API with order_id=${shipmozoOrderId}...`,
      );
      const res = await this.shipmozo.assignCourier(shipmozoOrderId);
      this.logger.debug(
        `[SHIPMOZO DEBUG] auto-assign-order OK: courier=${res.data.courier_company ?? 'null'} awb=${res.data.awb_number ?? 'null'} — saving ASSIGNED to DB`,
      );
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shipmentStatus: ShipmentStatus.ASSIGNED,
          courierPartner: res.data.courier_company ?? null,
          trackingId: res.data.awb_number ?? null,
          shipmentError: null,
        },
        select: shipmentSelect,
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: orderId,
        referenceNumber: orderNumber,
        action: `Courier "${res.data.courier_company ?? '?'}" assigned to order ${orderNumber} (AWB ${res.data.awb_number ?? '?'})`,
        formData: { response: res },
        auditedBy,
      });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `[SHIPMOZO DEBUG] auto-assign-order API FAILED for ${orderNumber}: ${message} — order stays PUSHED, error saved`,
      );
      this.logger.error(`Auto-assign courier failed for ${orderNumber}: ${message}`);
      // Push succeeded — keep the order PUSHED and just record why assign failed.
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { shipmentError: `Courier auto-assign failed: ${message}` },
        select: shipmentSelect,
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: orderId,
        referenceNumber: orderNumber,
        action: `Courier auto-assign failed for order ${orderNumber}`,
        formData: { error: message },
        auditedBy,
      });
      return updated;
    }
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
