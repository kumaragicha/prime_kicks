import { createParamDecorator, Logger, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Which storefront a request came from. Sent by the client as `x-storefront`.
 *
 *  - `reseller` — the wholesale app, served on its own private domain
 *  - `web`      — the public storefront (also the fallback for anything unrecognised)
 */
export type Storefront = 'web' | 'reseller';

export const STOREFRONT_HEADER = 'x-storefront';

/** Which price list to render for this caller. */
export type PricingAudience = 'RESELLER' | 'CUSTOMER';

const logger = new Logger('Storefront');

/**
 * The shared secret the reseller storefront must send in `x-storefront`.
 *
 * Read lazily (not at module load) so ConfigModule has already populated
 * process.env, and cached because it is checked on every catalogue request.
 */
let cachedKey: string | null | undefined;
let warned = false;

function resellerKey(): string | null {
  if (cachedKey === undefined) {
    cachedKey = process.env.RESELLER_STOREFRONT_KEY?.trim() || null;
  }
  return cachedKey;
}

/** Test seam — lets a spec change the key without reloading the module. */
export function __resetStorefrontKeyCache(): void {
  cachedKey = undefined;
  warned = false;
}

/**
 * Constant-time string comparison, so the number of matching leading characters
 * can't be inferred from response timing. Length is compared first and leaks, as
 * it does in every such scheme — the key's length is not the secret.
 */
function secretEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Resolve the calling storefront from the request headers.
 *
 * The header must carry the value of RESELLER_STOREFRONT_KEY. Anything else —
 * a wrong key, a missing header, the literal string "reseller" — resolves to
 * `web`, so every failure mode lands on the *more conservative* retail pricing.
 *
 * When the key is not configured the API **fails closed**: no request can select
 * reseller pricing, and a warning is logged once. A forgotten env var therefore
 * shows retail prices to resellers (visible, fixable) rather than wholesale
 * prices to the public (a leak).
 *
 * Outside production an unset key falls back to accepting the literal
 * "reseller", so local development works with no setup.
 */
export function readStorefront(headers: Record<string, unknown>): Storefront {
  const raw = headers[STOREFRONT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const presented = String(value ?? '');
  if (!presented) return 'web';

  const key = resellerKey();

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      if (!warned) {
        warned = true;
        logger.error(
          'RESELLER_STOREFRONT_KEY is not set — reseller pricing is DISABLED and every ' +
            'caller will see retail prices. Set it to the value the reseller app sends.',
        );
      }
      return 'web';
    }
    if (!warned) {
      warned = true;
      logger.warn(
        'RESELLER_STOREFRONT_KEY is not set — falling back to the literal "reseller" ' +
          'for local development. Production requires the key.',
      );
    }
    return presented.toLowerCase() === 'reseller' ? 'reseller' : 'web';
  }

  return secretEquals(presented, key) ? 'reseller' : 'web';
}

/** Injects the calling storefront into a handler param. */
export const CurrentStorefront = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Storefront =>
    readStorefront(ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>().headers),
);

/**
 * Decide which price list to SHOW a caller.
 *
 * An authenticated RESELLER always sees reseller pricing. On top of that, the
 * reseller storefront shows reseller pricing to visitors who have not signed in
 * yet — that app lives on a private domain shared only with wholesale partners.
 *
 * ⚠️ SECURITY BOUNDARY — read before reusing this.
 *
 * `RESELLER_STOREFRONT_KEY` raises the bar but is NOT a secret in the strict
 * sense: the reseller app is client-rendered, so the key ships inside its
 * JavaScript bundle and anyone who can load that site can read it from the
 * Network tab and replay it with curl. It stops guessing, not a determined
 * reader who has the link.
 *
 * What actually contains the risk is this rule:
 *
 *     this function decides what a caller SEES, never what they are CHARGED.
 *
 * Money is priced in OrdersService from the authenticated account's role alone
 * (see `useResellerPrice`), which no header can influence, and CartService is
 * deliberately left on role-only pricing so the cart mirrors what will be
 * charged. So a replayed key leaks price information but can never produce an
 * underpriced order.
 *
 * If reseller rates must not be readable at all, the fix is to require a signed-in
 * RESELLER before returning any price — not a longer header value.
 *
 * Do not use this helper to price an order, an invoice, or a payment.
 */
export function resolvePricingAudience(
  user: { role: UserRole } | AuthenticatedUser | undefined,
  storefront: Storefront,
): PricingAudience {
  if (user?.role === 'RESELLER') return 'RESELLER';
  if (storefront === 'reseller') return 'RESELLER';
  return 'CUSTOMER';
}
