import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addressSchema } from '@prime-kicks/validation';
import { AddressService } from '../address/address.service';
import { Public } from '../auth/decorators/public.decorator';
import { CourierConfigService } from '../courier-config/courier-config.service';
import { DimensionsService } from '../dimensions/dimensions.service';
import {
  ShipmozoService,
  type ShipmozoPushOrderPayload,
  type ShipmozoRateCalculatorPayload,
} from '../shipmozo/shipmozo.service';

/** The structured, reviewed address fields the UI sends when placing an order. */
interface AddressFields {
  name?: string;
  email?: string;
  mobileNo?: string;
  altMobileNo?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  pincode?: string;
  city?: string;
  state?: string;
}

/** Request body for the dev-only test-order tool. */
interface TestOrderBody {
  /** Raw, free-form address block pasted by the operator (used for dry-run parse). */
  addressBlock?: string;
  /** Reviewed/edited address fields (used when placing an order). */
  address?: AddressFields;
  /** Parcel weight in kilograms (the UI sends 1, 2 or 5; any > 0 works). */
  weightKg?: number;
  /** When true, only parse + build the payload — never touch Shipmozo. */
  dryRun?: boolean;
  /** When true (default), assign a courier (configured priority) after the push. */
  assignCourier?: boolean;
}

/** A configured courier that this route actually serves, in priority order. */
interface CourierCandidate {
  serviceTypeId: string;
  companyId: string;
  label: string;
}

/** The box dimensions used for the parcel, plus where they came from. */
interface ResolvedBox {
  weight: number; // grams
  length: number;
  width: number;
  height: number;
  source: string; // which Dimension row, or the env fallback
}

/** Map a parcel weight (grams) to the configured slab name. Mirrors the
 *  production `weightSlabForGrams` in shipment.service.ts. */
function weightSlab(grams: number): '1kg' | '2kg' | '5kg' {
  if (grams <= 1000) return '1kg';
  if (grams <= 2000) return '2kg';
  return '5kg';
}

/**
 * DEV-ONLY playground that reuses the EXISTING services — the {@link AddressService}
 * parser, the {@link ShipmozoService} client and the {@link CourierConfigService}
 * priority list — to push a throwaway order from a pasted address + chosen weight
 * and then assign a courier.
 *
 * Courier assignment follows the SAME rules as production: the rate calculator
 * reports which couriers serve the route, and we assign the admin's configured
 * couriers for that weight slab in their saved priority order, trying each until
 * one books.
 *
 * It is {@link Public} (no auth) and hard-refuses in production, so it can only
 * ever run against a local/dev API. Everything the real flow reads from a
 * persisted order (product line, dimensions, order id) is filled with dummies.
 */
@Controller('dev/test-order')
export class DevTestOrderController {
  constructor(
    private readonly address: AddressService,
    private readonly shipmozo: ShipmozoService,
    private readonly courierConfigs: CourierConfigService,
    private readonly dimensions: DimensionsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post()
  async create(@Body() body: TestOrderBody) {
    // Belt-and-braces: this tool must never be reachable on a production API.
    if ((this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production') {
      throw new NotFoundException();
    }

    const weightKg = Number(body?.weightKg ?? 1);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      throw new BadRequestException('weightKg must be a positive number.');
    }

    // Dimensions come from the Dimensions table entry matching the selected
    // weight (1kg/2kg/5kg), falling back to the env defaults when none matches.
    const box = await this.resolveBox(weightKg);

    // Dry run: parse the pasted block with the existing parser and hand back the
    // fields (so the UI can fill its editable form) plus the payload we'd send.
    if (body?.dryRun) {
      const addressBlock = (body?.addressBlock ?? '').trim();
      if (!addressBlock) {
        throw new BadRequestException('Paste an address block first.');
      }
      const parsed = this.address.parseAddressBlock(addressBlock);
      const payload = this.buildPayload(parsed, box);
      return { parsed, payload, slab: weightSlab(box.weight), box, dryRun: true };
    }

    // Placing an order: use the REVIEWED fields the operator edited, not a
    // re-parse — and validate them with the SAME schema the web/admin checkout
    // uses, so a missing name/phone/line1/pincode/city/state is rejected rather
    // than silently filled with a dummy.
    const address = this.normalizeAddress(body?.address);
    const check = addressSchema.safeParse(address);
    if (!check.success) {
      throw new BadRequestException(check.error.issues.map((i) => i.message));
    }
    const parsed = address;
    const payload = this.buildPayload(address, box);
    const slab = weightSlab(box.weight);

    if (!this.shipmozo.isConfigured()) {
      throw new BadRequestException(
        'Shipmozo is not configured (SHIPMOZO_PUBLIC_KEY / SHIPMOZO_PRIVATE_KEY missing in apps/api/.env).',
      );
    }

    // 1) Reuse the existing Shipmozo push-order client.
    const pushRes = await this.shipmozo.pushOrder(payload);
    const shipmozoOrderId = pushRes.data.order_id ? String(pushRes.data.order_id) : null;

    // Push-only mode, or we somehow got no order id back — stop here.
    if (body?.assignCourier === false || !shipmozoOrderId) {
      return { parsed, payload, slab, box, push: pushRes, shipmozoOrderId };
    }

    // 2) Configured couriers for this slab that the route actually serves,
    //    in the admin's saved priority order (same as production).
    const candidates = await this.selectCandidates(payload, slab);

    if (candidates.length === 0) {
      return {
        parsed,
        payload,
        slab,
        box,
        push: pushRes,
        shipmozoOrderId,
        candidates,
        assigned: null,
        assignErrors: [
          {
            id: '-',
            name: '-',
            error: `No configured courier for the ${slab} slab is serviceable on this route.`,
          },
        ],
      };
    }

    // 3) Assign each configured candidate in priority order until one books.
    //    Each failure is a result:"0" (nothing booked), so falling through is safe.
    const attempts: Array<{ id: string; name: string; error: string }> = [];
    for (const candidate of candidates) {
      try {
        const res = await this.shipmozo.assignCourier(shipmozoOrderId, candidate.serviceTypeId);
        const data = res.data;
        return {
          parsed,
          payload,
          slab,
          box,
          push: pushRes,
          shipmozoOrderId,
          candidates,
          assigned: {
            courierId: candidate.serviceTypeId,
            courier: data.courier_company ?? candidate.label,
            awbNumber: data.awb_number ?? null,
            raw: data,
          },
        };
      } catch (e) {
        attempts.push({
          id: candidate.serviceTypeId,
          name: candidate.label,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Pushed, but every configured courier rejected the route — report attempts.
    return {
      parsed,
      payload,
      slab,
      box,
      push: pushRes,
      shipmozoOrderId,
      candidates,
      assigned: null,
      assignErrors: attempts,
    };
  }

  /**
   * Run the existing rate calculator for the route/weight, then keep the admin's
   * configured couriers for this slab that the route actually serves — preserving
   * saved priority order and de-duplicating. Matches production's
   * `selectConfiguredCouriers` (match on service-type id).
   */
  private async selectCandidates(
    payload: ShipmozoPushOrderPayload,
    slab: '1kg' | '2kg' | '5kg',
  ): Promise<CourierCandidate[]> {
    const pickup = Number(
      (this.config.get<string>('SHIPMOZO_PICKUP_PINCODE') ?? '').replace(/\D/g, ''),
    );
    const delivery = Number(String(payload.consignee_pin_code).replace(/\D/g, ''));
    if (!pickup) {
      throw new BadRequestException('SHIPMOZO_PICKUP_PINCODE is not configured in apps/api/.env.');
    }
    if (!delivery) {
      throw new BadRequestException('The parsed address has no valid delivery pincode.');
    }

    const ratePayload: ShipmozoRateCalculatorPayload = {
      order_id: '',
      pickup_pincode: pickup,
      delivery_pincode: delivery,
      payment_type: 'PREPAID',
      shipment_type: 'FORWARD',
      order_amount: 4999,
      type_of_package: 'SPS',
      rov_type: 'ROV_OWNER',
      cod_amount: '',
      weight: payload.weight,
      dimensions: [
        {
          no_of_box: '1',
          length: String(payload.length),
          width: String(payload.width),
          height: String(payload.height),
        },
      ],
    };

    const res = await this.shipmozo.rateCalculator(ratePayload);
    const couriers = Array.isArray(res.data) ? res.data : [];
    if (couriers.length === 0) {
      throw new BadRequestException(
        `Delivery pincode ${delivery} is not serviceable from pickup pincode ${pickup}.`,
      );
    }

    // Every service-type id the route offers (matching key is `id`).
    const availableIds = new Set(
      couriers
        .map((c) => {
          const v = (c as Record<string, unknown>).id;
          return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
        })
        .filter((id) => id.length > 0),
    );

    const configured = await this.courierConfigs.findByWeightSlab(slab);
    const seen = new Set<string>();
    const candidates: CourierCandidate[] = [];
    for (const cfg of configured) {
      const serviceTypeId = cfg.courierCompanyServiceTypeId.trim();
      if (!availableIds.has(serviceTypeId) || seen.has(serviceTypeId)) continue;
      seen.add(serviceTypeId);
      candidates.push({
        serviceTypeId,
        companyId: cfg.courierCompanyId.trim(),
        label: cfg.label ?? serviceTypeId,
      });
    }
    return candidates;
  }

  /** Coerce the (possibly partial) UI address into the full field shape, trimmed. */
  private normalizeAddress(a: AddressFields = {}): ReturnType<AddressService['parseAddressBlock']> {
    const s = (v: string | undefined) => (v ?? '').trim();
    return {
      name: s(a.name),
      email: s(a.email),
      mobileNo: s(a.mobileNo),
      altMobileNo: s(a.altMobileNo),
      line1: s(a.line1),
      line2: s(a.line2),
      landmark: s(a.landmark),
      pincode: s(a.pincode),
      city: s(a.city),
      state: s(a.state),
    };
  }

  /**
   * Resolve the parcel box from the Dimensions table: the active dimension whose
   * weight (kg) equals the selected weight is used for length/width/height. When
   * none matches, fall back to the env defaults.
   */
  private async resolveBox(weightKg: number): Promise<ResolvedBox> {
    const envInt = (key: string, fallback: number) => {
      const raw = Number(this.config.get<string>(key));
      return Number.isFinite(raw) && raw > 0 ? raw : fallback;
    };
    const grams = Math.round(weightKg * 1000);

    const dims = await this.dimensions.findAll();
    const match = dims.find((d) => Math.round(d.weight * 1000) === grams);
    if (match) {
      return {
        weight: grams,
        length: Math.round(match.length),
        width: Math.round(match.width),
        height: Math.round(match.height),
        source: `dimension "${match.name}" (${match.weight}kg)`,
      };
    }

    return {
      weight: grams,
      length: envInt('SHIPMOZO_DEFAULT_LENGTH_CM', 30),
      width: envInt('SHIPMOZO_DEFAULT_WIDTH_CM', 20),
      height: envInt('SHIPMOZO_DEFAULT_HEIGHT_CM', 12),
      source: `env default (no ${weightKg}kg dimension configured)`,
    };
  }

  /** Build a Shipmozo push-order body from the address + resolved box, filling
   *  every order-derived field (id, product line) with dummy data. */
  private buildPayload(
    parsed: ReturnType<AddressService['parseAddressBlock']>,
    box: ResolvedBox,
  ): ShipmozoPushOrderPayload {
    const num = (v: string) => v.replace(/\D/g, '');

    const phone = num(parsed.mobileNo);
    const altPhone = num(parsed.altMobileNo);
    // Shipmozo rejects an alternate phone equal to the main phone, so only send
    // it when it's present AND actually different.
    const alternatePhone = altPhone && altPhone !== phone ? altPhone : undefined;
    // Fold a landmark into line two (Shipmozo has no landmark field), matching
    // the production push behavior.
    const lineTwo =
      [parsed.line2, parsed.landmark].map((x) => x.trim()).filter(Boolean).join(' ') || undefined;

    return {
      order_id: `TEST-${Date.now()}`,
      order_date: new Date().toISOString().slice(0, 10),
      order_type: 'ESSENTIALS',
      consignee_name: parsed.name,
      consignee_phone: phone,
      consignee_alternate_phone: alternatePhone,
      consignee_email: parsed.email || undefined,
      consignee_address_line_one: parsed.line1,
      consignee_address_line_two: lineTwo,
      consignee_pin_code: num(parsed.pincode),
      consignee_city: parsed.city,
      consignee_state: parsed.state,
      product_detail: [
        {
          name: 'shoes',
          sku_number: 'TEST-SKU',
          quantity: 1,
          unit_price: 4999,
          discount: '',
          hsn: '',
          product_category: 'Other',
        },
      ],
      payment_type: 'PREPAID',
      cod_amount: '',
      // Weight (grams) and box dimensions come from the resolved Dimension.
      weight: box.weight,
      length: box.length,
      width: box.width,
      height: box.height,
      // Note the (intentional) key spelling used across the .env files.
      warehouse_id: this.config.get<string>('SHIPMOZO_WEARHOUSE_ID')?.trim() ?? '',
      gst_ewaybill_number: '',
      gstin_number: '',
    };
  }
}
