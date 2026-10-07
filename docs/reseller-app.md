# Reseller storefront

`apps/reseller` is the wholesale storefront, served on its own private domain
and shared only with reseller/wholesale partners. It is the same shop as
`apps/web` with two differences: **search is the landing page** (there is no
marketing home), and **prices are reseller prices**.

## Layout

```
apps/web/app         routes only — thin re-exports + home page
apps/reseller/app    routes only — thin re-exports, "/" = search
packages/storefront  everything both apps share
  src/components     site header/footer, product card, search panel, login modal…
  src/pages          the actual page implementations (search, cart, orders, …)
  src/lib            api client, hooks, brand logos
  src/styles         globals.css (theme, keyframes)
  src/providers.tsx  react-query provider
```

Both apps alias `@/*` → `packages/storefront/src/*`, so a component still
imports `@/components/icon` exactly as before. A route file is one line:

```tsx
export { default } from '@/pages/search-page';
```

Fix a bug in `packages/storefront` and both storefronts get it. There is no
duplicated page code.

### Not shared

| Stays in `apps/web` | Why |
| --- | --- |
| `page.tsx`, `home-client.tsx` | The reseller app has no home page |
| `sitemap.ts`, `robots.ts` | Web is indexed; reseller is not |
| `GoogleAnalytics.tsx` | Retail analytics only |
| `products/[id]/page.tsx` | Web does a server-side fetch for Open Graph tags; reseller doesn't (see below) |

## How reseller pricing works

The browser never sees the secret. The reseller app points
`NEXT_PUBLIC_API_URL` at its **own** `/api`, and
`apps/reseller/app/api/[...path]/route.ts` proxies each call to the real API,
injecting the `x-storefront` header server-side:

```
browser → localhost:3002/api/*  (no secret)
        → reseller Next server  (adds x-storefront: <key>)
        → NestJS API            (returns wholesale prices)
```

`RESELLER_STOREFRONT_KEY` in `apps/reseller/.env` is deliberately **not**
prefixed `NEXT_PUBLIC_`, so it is never compiled into the client bundle. The
proxy also strips any `x-storefront` the caller supplies, so a client cannot
choose its own storefront.

The public storefront calls the API directly and sends no such header.

The API compares the header (constant-time) against `RESELLER_STOREFRONT_KEY` in
`apps/api/.env`. **Both values must match.** Generate one with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

If the API key is unset, reseller pricing **fails closed**: in production nothing
selects wholesale pricing and an error is logged at first use, so a forgotten env
var shows retail prices to resellers (visible, fixable) rather than wholesale
prices to the public (a leak). Outside production the literal `reseller` is
accepted so local dev needs no setup.

Then `apps/api/src/common/storefront.ts`:

```
resolvePricingAudience(user, storefront)
  user.role === 'RESELLER'  → RESELLER
  storefront === 'reseller' → RESELLER   ← anonymous visitors on the private domain
  otherwise                 → CUSTOMER
```

Applied in `ProductsService.shapeProduct` for `/products`, `/products/:id` and
`/products/:id/similar`. Verified against the live API: the same product returns
`price=2300` without the header and `price=1900` with it.

### Security boundary — read before extending this

**Never move the key into a `NEXT_PUBLIC_` variable.** An earlier version did,
and the key was readable straight out of the served bundle:

```
const STOREFRONT_KEY = "FAXpQuFl…" ?? 0;     ← in page.js, visible in DevTools
```

Encrypting or obfuscating it does not fix that: the browser needs the key in
order to use it, so whatever protects it ships alongside it. Not sending it is
the only fix, which is what the proxy does. After the change, the key appears in
0 of the 6 served scripts, in no inline HTML, and in no runtime env object.

Two things still hold regardless of the key:

> The header decides what a caller **sees**, never what they are **charged**.

Order totals are computed in `OrdersService` from the authenticated account's
role alone (`useResellerPrice = isResellerOrder || ownerRole === 'RESELLER'`).
No header reaches that code. `CartService` is deliberately left on role-only
pricing too, because the cart must mirror what will be charged — if the cart
honoured the header, a `CUSTOMER` browsing the reseller domain would see
wholesale totals and then be billed retail.

So a forged header leaks price *information* but can never produce an
underpriced order. If leaking reseller rates is unacceptable, the fix is to
require login before returning any price — not to obfuscate the header.

The reseller app is additionally `noindex` three ways: `X-Robots-Tag` response
header, `robots.ts` disallowing everything, and `robots` metadata in the layout.
The product page skips web's server-side Open Graph fetch, which would otherwise
render *retail* prices into the metadata (that fetch runs without the header).

## Accounts and sign-in

Storefront auth is **mobile number + WhatsApp OTP. No password, no email.**

```
POST /auth/otp/start   { mobileNo }              → sends a code, returns isNewUser
POST /auth/otp/verify  { mobileNo, code, name? } → signs in, creating the account if new
POST /auth/otp/resend  { mobileNo }              → fresh code, 60s cooldown
```

One flow serves sign-up and sign-in: `isNewUser` tells the UI whether to show a
name field. Signup collects **a name and a mobile number, nothing else** —
`email`, `passwordHash`, `city` and `state` are null on these accounts, and the
delivery details come from the address captured at checkout.

Numbers are normalized to E.164 (`9876543210` → `+919876543210`) before lookup,
so one person cannot end up with several accounts by typing their number
differently. Lookups also tolerate legacy rows stored without the `+`.

Signing up **on the reseller domain creates a `RESELLER` account directly** — no
admin approval step. Role is derived server-side from the storefront
(`AuthService.roleForStorefront`) and any submitted `role` field is discarded.

`POST /auth/login` (email/mobile + password) still exists and is unchanged — the
**admin app depends on it**, and pre-existing accounts keep their passwords.
OTP-only accounts have a null `passwordHash`, so they simply fail that path.

Because OTP accounts have no email, the JWT's `email` claim falls back to the
mobile number. Every `auditedBy: user.email` call site relies on that being
non-null — see `AuthService.issueTokens` and `JwtStrategy.validate`.

> ⚠️ Before this change, `role` was taken straight from the signup request body,
> so a client could post `{"role":"ADMIN"}` and mint an administrator. That is
> now closed everywhere: the public storefront always yields `CUSTOMER`, the
> reseller storefront always yields `RESELLER`, and `ADMIN` is never
> self-service. **Audit existing production accounts for unexpected roles.**

## Running it

```bash
npm run dev --workspace @prime-kicks/reseller   # port 3002
```

| App | Port |
| --- | --- |
| web | 3000 |
| reseller | 3002 |
| api | 4000 |

## Known gaps

- The reseller app serves `/search` as well as `/`, so old links keep working.
- A **soft-deleted** account's number reports `isNewUser: true`, but verifying
  then fails with "already registered" (the row still holds the unique
  `mobileNo`). Restoring a soft-deleted customer is an admin action, so the flow
  refuses rather than silently resurrecting or duplicating the account — but the
  message arrives one step later than it should.
- `/auth/otp/start` reveals whether a number already has an account
  (`isNewUser`). That is a deliberate trade-off — the UI must know whether to
  ask for a name — and is how essentially every OTP sign-in works.
- WhatsApp OTP cannot actually send until a real WABA exists — see
  `whatsapp-otp.md`. Until then codes print to the API console in development.
