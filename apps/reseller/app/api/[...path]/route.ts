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

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
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
