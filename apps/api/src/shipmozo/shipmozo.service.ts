import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_BASE_URL = 'https://shipping-api.com/app/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;
/** Retry only truly transient failures (no response received). */
const MAX_NETWORK_RETRIES = 2;
const RETRY_BACKOFF_MS = 400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Shared envelope every Shipmozo endpoint returns. */
export interface ShipmozoResponse<T = Record<string, unknown>> {
  /** "1" for success, "0" for failure. */
  result: string;
  message: string;
  data: T;
}

/** The `product_detail` line-item shape the push-order endpoint expects. */
export interface ShipmozoProductDetail {
  name: string;
  sku_number: string;
  quantity: number;
  unit_price: number;
  discount?: string;
  hsn?: string;
  product_category?: string;
}

/** Request body for the push-order endpoint. */
export interface ShipmozoPushOrderPayload {
  order_id: string;
  order_date: string;
  order_type?: string;
  consignee_name: string;
  consignee_phone: number | string;
  consignee_alternate_phone?: number | string;
  consignee_email?: string;
  consignee_address_line_one: string;
  consignee_address_line_two?: string;
  consignee_pin_code: number | string;
  consignee_city: string;
  consignee_state: string;
  product_detail: ShipmozoProductDetail[];
  payment_type: 'PREPAID' | 'COD';
  cod_amount?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  warehouse_id: string;
  gst_ewaybill_number?: string;
  gstin_number?: string;
}

/** The `data` block returned by push-order on success. */
export interface ShipmozoPushOrderData {
  Info?: string;
  order_id?: string;
  reference_id?: string;
}

/** A courier option returned by the rate-calculator endpoint. Fields vary per
 *  courier, so the API's own response is simply echoed through. */
export interface ShipmozoRateCalculatorCourier {
  [key: string]: unknown;
}

/** One box/dimension entry in a rate-calculator request. */
export interface ShipmozoRateCalculatorDimension {
  no_of_box: string;
  length: string;
  width: string;
  height: string;
}

/** Request body for the rate-calculator endpoint. */
export interface ShipmozoRateCalculatorPayload {
  order_id?: string;
  pickup_pincode: number;
  delivery_pincode: number;
  payment_type: 'PREPAID' | 'COD';
  shipment_type: string;
  order_amount: number;
  type_of_package: string;
  rov_type: string;
  cod_amount?: string;
  weight: number;
  dimensions: ShipmozoRateCalculatorDimension[];
}

/** The `data` block returned by assign-courier on success. */
export interface ShipmozoAssignCourierData {
  order_id?: string;
  reference_id?: string;
  awb_number?: string;
  courier_company?: string;
  courier_company_service?: string;
}

/** The `data` block returned by cancel-order on success. */
export interface ShipmozoCancelOrderData {
  order_id?: string;
  reference_id?: string;
}

/**
 * The `data` block returned by get-order-detail. Shipmozo's shape varies, so
 * every field is optional and alternate key spellings are allowed — the caller
 * picks whichever is present. May also arrive as a single-element array.
 */
export interface ShipmozoOrderDetailData {
  order_id?: string | number;
  reference_id?: string | number;
  awb_number?: string | number;
  tracking_number?: string | number;
  awb?: string | number;
  courier_company?: string;
  courier_name?: string;
  courier?: string;
  order_status?: string;
  shipment_status?: string;
  [key: string]: unknown;
}

/**
 * Thin HTTP client for the Shipmozo "External V1" API. Handles auth headers,
 * base-url resolution and the result "1"/"0" envelope; knows nothing about our
 * domain (see {@link ShipmentService} for that).
 */
@Injectable()
export class ShipmozoService {
  private readonly logger = new Logger(ShipmozoService.name);

  constructor(private readonly config: ConfigService) {}

  /** True when both API keys are configured — lets callers no-op gracefully. */
  isConfigured(): boolean {
    return Boolean(this.publicKey() && this.privateKey());
  }

  private publicKey(): string | undefined {
    return this.config.get<string>('SHIPMOZO_PUBLIC_KEY')?.trim() || undefined;
  }

  private privateKey(): string | undefined {
    return this.config.get<string>('SHIPMOZO_PRIVATE_KEY')?.trim() || undefined;
  }

  private baseUrl(): string {
    return (this.config.get<string>('SHIPMOZO_BASE_URL')?.trim() || DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
  }

  private headers(): Record<string, string> {
    const publicKey = this.publicKey();
    const privateKey = this.privateKey();
    if (!publicKey || !privateKey) {
      throw new ServiceUnavailableException(
        'Shipmozo is not configured (SHIPMOZO_PUBLIC_KEY / SHIPMOZO_PRIVATE_KEY missing).',
      );
    }
    return {
      'Content-Type': 'application/json',
      'public-key': publicKey,
      'private-key': privateKey,
    };
  }

  private timeoutMs(): number {
    const raw = Number(this.config.get<string>('SHIPMOZO_TIMEOUT_MS'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
  }

  /** Health check — GET /info. Resolves the parsed envelope or throws. */
  async info(): Promise<ShipmozoResponse<{ Info?: string }>> {
    // GET is idempotent — safe to retry on transient network *and* 5xx errors.
    return this.call<{ Info?: string }>('/info', { method: 'GET' }, true);
  }

  /**
   * Fetch a Shipmozo order's details by its order id — GET
   * /get-order-detail/{order_id}. Used to validate that an admin-supplied order
   * id really exists in the Shipmozo panel before we attach it. GET is
   * idempotent, so it's safe to retry on transient errors.
   */
  async getOrderDetail(
    shipmozoOrderId: string,
  ): Promise<ShipmozoResponse<ShipmozoOrderDetailData>> {
    return this.call<ShipmozoOrderDetailData>(
      `/get-order-detail/${encodeURIComponent(shipmozoOrderId)}`,
      { method: 'GET' },
      true,
    );
  }

  /**
   * Calculate courier rates / check delivery serviceability — POST
   * /rate-calculator. A non-empty `data` courier list means the delivery
   * pincode is serviceable from the pickup pincode. Read-only, so it's treated
   * as idempotent (safe to retry).
   */
  async rateCalculator(
    payload: ShipmozoRateCalculatorPayload,
  ): Promise<ShipmozoResponse<ShipmozoRateCalculatorCourier[]>> {
    return this.call<ShipmozoRateCalculatorCourier[]>(
      '/rate-calculator',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  /** Push an order into the Shipmozo panel — POST /push-order. */
  async pushOrder(
    payload: ShipmozoPushOrderPayload,
  ): Promise<ShipmozoResponse<ShipmozoPushOrderData>> {
    // POST is NOT idempotent: a lost response could mean the order already
    // landed, so we never retry once bytes have gone out (only on connect fail).
    return this.call<ShipmozoPushOrderData>(
      '/push-order',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    );
  }

  /**
   * Assign the chosen courier to a pushed Shipmozo order — POST /assign-courier.
   * The endpoint takes `order_id` (from push-order) and `courier_id` — the
   * numeric courier id from the rate-calculator response. Sends `courier_id` as
   * a number when the id is cleanly numeric (the API requires a number), else
   * the raw string.
   */
  async assignCourier(
    shipmozoOrderId: string,
    courierId: string,
  ): Promise<ShipmozoResponse<ShipmozoAssignCourierData>> {
    const digits = courierId.replace(/\D/g, '');
    const body = {
      order_id: shipmozoOrderId,
      courier_id: digits.length > 0 && digits === courierId.trim() ? Number(digits) : courierId,
    };
    this.logger.debug(
      `[SHIPMOZO DEBUG] POST ${this.baseUrl()}/assign-courier body=${JSON.stringify(body)}`,
    );
    // Non-idempotent: a repeated assign could book a second shipment, so retry
    // only on connection failures — never once the request bytes have gone out.
    const res = await this.call<ShipmozoAssignCourierData>(
      '/assign-courier',
      { method: 'POST', body: JSON.stringify(body) },
      false,
    );
    this.logger.debug(`[SHIPMOZO DEBUG] assign-courier response=${JSON.stringify(res)}`);
    return res;
  }

  /**
   * Cancel an order/shipment in the Shipmozo panel — POST /cancel-order.
   * Requires the Shipmozo `order_id`; `awbNumber` is sent when known (required
   * by the API for assigned shipments). Sends the AWB as a number when it's
   * cleanly numeric, else as the raw string.
   */
  async cancelOrder(
    shipmozoOrderId: string,
    awbNumber: string | null,
  ): Promise<ShipmozoResponse<ShipmozoCancelOrderData>> {
    const body: Record<string, unknown> = { order_id: shipmozoOrderId };
    if (awbNumber) {
      const digits = awbNumber.replace(/\D/g, '');
      body.awb_number = digits.length > 0 && digits === awbNumber ? Number(digits) : awbNumber;
    }
    this.logger.debug(
      `[SHIPMOZO DEBUG] POST ${this.baseUrl()}/cancel-order body=${JSON.stringify(body)}`,
    );
    // Non-idempotent: retry only on connection failures, never once sent.
    const res = await this.call<ShipmozoCancelOrderData>(
      '/cancel-order',
      { method: 'POST', body: JSON.stringify(body) },
      false,
    );
    this.logger.debug(`[SHIPMOZO DEBUG] cancel-order response=${JSON.stringify(res)}`);
    return res;
  }

  /**
   * Perform a request and normalize the outcome: a non-2xx response, a network
   * error, or a `result: "0"` body all surface as a BadGateway with Shipmozo's
   * own message where available. A per-request AbortController enforces a hard
   * timeout so a hung connection can never stall the caller.
   *
   * `idempotent` requests (GET) retry on both connection failures and 5xx;
   * non-idempotent requests (POST) retry ONLY on connection failures, so a
   * request that may have already been processed server-side is never repeated.
   */
  private async call<T>(
    path: string,
    init: RequestInit,
    idempotent: boolean,
  ): Promise<ShipmozoResponse<T>> {
    const url = `${this.baseUrl()}${path}`;
    const headers = this.headers();
    let lastError: Error | undefined;

    this.logger.debug(
      `[SHIPMOZO HTTP] ${init.method ?? 'GET'} ${url} body=${typeof init.body === 'string' ? init.body : '(none)'}`,
    );
    for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs());
      let res: Response;
      try {
        res = await fetch(url, { ...init, headers, signal: controller.signal });
      } catch (error) {
        // No response received (network error / timeout) — safe to retry either verb.
        lastError =
          error instanceof Error
            ? controller.signal.aborted
              ? new Error(`request timed out after ${this.timeoutMs()}ms`)
              : error
            : new Error(String(error));
        this.logger.debug(
          `[SHIPMOZO HTTP] NETWORK ERROR ${init.method} ${path} (attempt ${attempt + 1}/${MAX_NETWORK_RETRIES + 1}): ${lastError.message}`,
        );
        this.logger.warn(
          `Shipmozo ${init.method} ${path} network error (attempt ${attempt + 1}): ${lastError.message}`,
        );
        if (attempt < MAX_NETWORK_RETRIES) {
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
          continue;
        }
        this.logger.debug(`[SHIPMOZO HTTP] GIVING UP ${init.method} ${path}: ${lastError.message}`);
        throw new BadGatewayException(`Could not reach Shipmozo: ${lastError.message}`);
      } finally {
        clearTimeout(timer);
      }

      // A 5xx is retryable for idempotent GETs only; every other response is final.
      if (res.status >= 500 && idempotent && attempt < MAX_NETWORK_RETRIES) {
        this.logger.warn(`Shipmozo ${init.method} ${path} ${res.status} — retrying`);
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }

      return this.parse<T>(path, init.method ?? 'GET', res);
    }

    // Unreachable in practice (the loop either returns or throws), but keeps TS happy.
    throw new BadGatewayException(`Could not reach Shipmozo: ${lastError?.message ?? 'unknown'}`);
  }

  /** Parse and validate a received response into the success envelope. */
  private async parse<T>(
    path: string,
    method: string,
    res: Response,
  ): Promise<ShipmozoResponse<T>> {
    const text = await res.text();
    this.logger.debug(
      `[SHIPMOZO HTTP] RESPONSE ${method} ${path} status=${res.status} body=${text}`,
    );
    let body: ShipmozoResponse<T> | undefined;
    try {
      body = text ? (JSON.parse(text) as ShipmozoResponse<T>) : undefined;
    } catch {
      // non-JSON body — handled below
    }

    if (!res.ok || !body) {
      const detail = body?.message || text || `HTTP ${res.status}`;
      this.logger.debug(`[SHIPMOZO HTTP] FAILED ${method} ${path}: ${detail}`);
      this.logger.error(`Shipmozo ${method} ${path} failed: ${detail}`);
      throw new BadGatewayException(`Shipmozo request failed: ${detail}`);
    }

    if (body.result !== '1') {
      // The human message is often just "Error"; the useful detail sits in
      // `data.error` (or similar), so fold it in for diagnostics.
      const dataError =
        body.data && typeof body.data === 'object'
          ? ((body.data as Record<string, unknown>).error ??
            (body.data as Record<string, unknown>).message)
          : undefined;
      const detail = [body.message, dataError].filter(Boolean).join(': ');
      this.logger.debug(
        `[SHIPMOZO HTTP] RESULT=0 (failure) ${method} ${path}: ${detail || '(no detail)'}`,
      );
      this.logger.warn(`Shipmozo ${method} ${path} returned failure: ${detail}`);
      throw new BadGatewayException(detail || 'Shipmozo returned a failure result.');
    }

    this.logger.debug(`[SHIPMOZO HTTP] SUCCESS ${method} ${path} result=1`);
    return body;
  }
}
