import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** 3000 web · 3001 admin · 3002 reseller. */
const DEFAULT_ORIGINS = 'http://localhost:3000,http://localhost:3001,http://localhost:3002';

/**
 * CORS configuration for the API.
 *
 * ⚠️ Do NOT add `allowedHeaders`.
 *
 * Leaving it unset makes the cors middleware reflect whatever the browser lists
 * in `Access-Control-Request-Headers`, so every client header works — today's
 * `Idempotency-Key` and `x-storefront`, and whatever is added next.
 *
 * An explicit list has already broken production checkout once: it named
 * Content-Type/Authorization/x-storefront and omitted `Idempotency-Key`, so the
 * preflight passed but the real `POST /orders` was blocked, surfacing in the
 * browser as an opaque CORS error with no useful message.
 *
 * Enumerating headers is not a security control in any case. CORS header
 * allow-listing authenticates nobody; `origin` and the JWT do that. The
 * regression test in cors.spec.ts asserts this stays unset.
 */
export function corsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const origins = (env.CORS_ORIGINS ?? DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return { origin: origins, credentials: true };
}
