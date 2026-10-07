# @prime-kicks/storefront

Components and client-side data access shared by the two storefront apps:

- `apps/web` — the public storefront (primekicks.com)
- `apps/reseller` — the wholesale storefront, on its own private domain

Both apps alias `@/*` to `src/*` here, so a component imports its siblings as
`@/components/icon` regardless of which app renders it. App-specific code
(routes, layouts, page shells) stays in each app's own `app/` directory.

`lib/api.ts` reads `NEXT_PUBLIC_STOREFRONT` to decide the `x-storefront` header
sent on every request — that is what makes the reseller app receive reseller
pricing. See `apps/api/src/common/storefront.ts` for the server half, including
why that header can never affect what a customer is charged.
