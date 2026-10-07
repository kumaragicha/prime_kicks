import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side proxy to the NestJS API.
 *
 * The browser calls this app's own `/api/*`; this handler forwards to the real
 * API and injects the `x-storefront` secret **on the server**. That is the whole
 * point: `RESELLER_STOREFRONT_KEY` is a plain (non-`NEXT_PUBLIC_`) env var, so it
 * is never compiled into the client bundle and cannot be read out of DevTools or
 * replayed with curl.
 *
 * The previous design sent the key from the browser. It stopped guessing, but
 * anyone who could load the reseller site could read the key out of `page.js`.
 * Encrypting it would not have helped — the browser needs the key to use it, so
 * the key ships alongside whatever protects it. Not sending it is the only fix.
 *
 * Everything else is passed through untouched: method, path, query string,
 * request body, and the caller's `Authorization` header (the access token still
 * lives in the browser — it identifies the user, and is theirs to hold).
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Set by us, never taken from the caller — a client must not be able to
  // choose its own storefront.
  'x-storefront',
  // Let fetch recompute these for the outgoing request.
  'host',
  'content-length',
]);

/** Origin of the NestJS API, including its `/api` prefix. Server-only. */
function apiBase(): string {
  return process.env.API_URL ?? 'http://localhost:4000/api';
}

function forwardableHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const key = process.env.RESELLER_STOREFRONT_KEY?.trim();
  if (key) {
    headers.set('x-storefront', key);
  } else {
    // Without the key the API falls back to retail pricing, which silently makes
    // this a second public storefront — worth shouting about in the server log.
    console.error(
      '[reseller-proxy] RESELLER_STOREFRONT_KEY is not set — requests will receive ' +
        'RETAIL pricing. Set it in apps/reseller/.env (must match the API).',
    );
  }
  return headers;
}

/**
 * TEMPORARY diagnostic — remove once reseller pricing is confirmed working.
 *
 * GET /api/__proxy-status tells you exactly what this Worker sees and what the
 * real API answers, WITHOUT revealing RESELLER_STOREFRONT_KEY: only presence,
 * length and a 4-byte SHA-256 fingerprint (not reversible for a 256-bit random
 * key). Compare `keyFingerprint` with the one computed on the API server.
 *
 * `selfTest` makes the same call the proxy makes, once with the key and once
 * without, and reports the status and first product price of each — if
 * `withKey.price` is lower than `withoutKey.price`, the whole chain works.
 */
async function sha4(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function probe(headers: Record<string, string>) {
  const url = `${apiBase()}/products?pageSize=1`;
  try {
    const res = await fetch(url, { headers, cache: 'no-store', redirect: 'manual' });
    const text = await res.text();
    let price: unknown = null;
    let name: unknown = null;
    try {
      const first = (JSON.parse(text) as { data?: Array<{ price?: unknown; name?: unknown }> }).data?.[0];
      price = first?.price ?? null;
      name = first?.name ?? null;
    } catch {
      /* not JSON — keep price null and show a snippet below */
    }
    return {
      status: res.status,
      price,
      product: name,
      bodySnippet: price === null ? text.slice(0, 160) : undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function proxyStatus(): Promise<Response> {
  const key = process.env.RESELLER_STOREFRONT_KEY?.trim();
  const base = apiBase();
  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      key: {
        configured: Boolean(key),
        length: key?.length ?? 0,
        fingerprint: key ? await sha4(key) : null,
        hasSurroundingQuotes: key ? /^["']|["']$/.test(key) : false,
      },
      api: {
        base,
        usingLocalhostFallback: !process.env.API_URL,
      },
      // Names only, never values. Shows whether a variable/secret reached the Worker.
      envVariableNames: Object.keys(process.env).sort(),
      selfTest: {
        withoutKey: await probe({}),
        withKey: key ? await probe({ 'x-storefront': key }) : 'skipped — no key in Worker env',
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (request.method === 'GET' && path.length === 1 && path[0] === '__proxy-status') {
    return proxyStatus();
  }
  const target = `${apiBase()}/${path.join('/')}${request.nextUrl.search}`;

  // GET/HEAD must not carry a body; everything else forwards the raw bytes so
  // JSON, form data and uploads all pass through unchanged.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: forwardableHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      // Never let Next cache an API response — prices and carts are per-caller.
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (error) {
    console.error(
      `[reseller-proxy] ${request.method} ${path.join('/')} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return NextResponse.json(
      { message: 'The store is unreachable right now. Please try again.' },
      { status: 502 },
    );
  }

  // Pass the upstream status and body straight back, preserving the content type
  // so the client's error parsing keeps working unchanged.
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', 'no-store');

  // TEMPORARY debug headers — visible in the browser Network tab. No secrets.
  const keyAttached = Boolean(process.env.RESELLER_STOREFRONT_KEY?.trim());
  headers.set('x-debug-key-attached', String(keyAttached));
  headers.set('x-debug-upstream-status', String(upstream.status));
  headers.set('x-debug-api-base', apiBase());
  // warn, not log: next.config.mjs strips console.log from production builds.
  console.warn(
    `[reseller-proxy] ${request.method} /${path.join('/')} -> ${upstream.status} keyAttached=${keyAttached}`,
  );

  return new NextResponse(body, { status: upstream.status, headers });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

/** Prices and carts are per-caller — this route must never be statically cached. */
export const dynamic = 'force-dynamic';
