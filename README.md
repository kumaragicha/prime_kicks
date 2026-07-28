# Prime Kicks

A reseller ecommerce platform built as a Turborepo monorepo.

## Structure

```
prime-kicks/
├── apps/
│   ├── web/     Next.js storefront   (Tailwind, TanStack Query)          → :3000
│   ├── admin/   Next.js admin panel  (Tailwind, TanStack Table, RHF)     → :3001
│   └── api/     NestJS backend       (Prisma, PostgreSQL)                → :4000
├── packages/
│   ├── ui/                 Shared React components (Button, Card, Badge)
│   ├── types/              Shared TypeScript domain types
│   ├── validation/         Shared Zod schemas (used by API + forms)
│   ├── utils/              Shared helpers (currency, slug, cn)
│   └── typescript-config/  Shared tsconfig presets
└── turbo.json              Turborepo pipeline
```

The `validation` and `types` packages are the contract between backend and
frontends: the API validates requests with the same Zod schemas the admin
forms use, and both consume the same `Product`/`Order`/`User` types.

## Prerequisites

- Node.js >= 20
- A PostgreSQL instance (local install, managed service, etc.)

## Getting started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure env — point DATABASE_URL at your Postgres instance
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

# 3. Generate the Prisma client, run migrations, and seed
npm run prisma:generate -w @prime-kicks/api
npm run prisma:migrate  -w @prime-kicks/api -- --name init
npm run db:seed         -w @prime-kicks/api

# 4. Run everything
npm run dev
```

- Storefront → http://localhost:3000
- Admin      → http://localhost:3001
- API        → http://localhost:4000/api  (health: `/api/health`)

## Authentication

The API uses JWT bearer auth with a **global** `JwtAuthGuard` — every route
requires a valid token unless annotated with `@Public()`. A `RolesGuard`
enforces `@Roles(...)` on top of that.

| Route                     | Access                         |
| ------------------------- | ------------------------------ |
| `POST /api/auth/register` | public                         |
| `POST /api/auth/login`    | public                         |
| `POST /api/auth/refresh`  | public (valid refresh token)   |
| `POST /api/auth/logout`   | any authenticated user         |
| `GET  /api/auth/me`       | any authenticated user         |
| `GET  /api/products`      | public                         |
| `POST /api/products`      | `ADMIN` or `RESELLER`          |
| `PATCH /api/products/:id` | `ADMIN` or `RESELLER`          |
| `DELETE /api/products/:id`| `ADMIN`                        |

**Tokens:** login/register/refresh return a short-lived `accessToken` (15m) and
a long-lived `refreshToken` (7d). The refresh token is hashed (sha256 → bcrypt)
and stored on the user; `POST /auth/refresh` rotates it, `POST /auth/logout`
revokes it. Passwords are hashed with bcrypt.

The seed creates two logins (password `password123`):
`admin@primekicks.dev` (ADMIN) and `reseller@primekicks.dev` (RESELLER).

```bash
# Log in and capture the token
TOKEN=$(curl -s localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@primekicks.dev","password":"password123"}' | jq -r .accessToken)

# Call a protected route
curl localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

Protect a new route with `@Roles('ADMIN')`; open one up with `@Public()`.
Inject the caller with the `@CurrentUser()` param decorator.

## Common commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Run all apps in watch mode via Turborepo      |
| `npm run build`     | Build every app and package                   |
| `npm run lint`      | Lint the whole monorepo                        |
| `npm run typecheck` | Type-check every workspace                     |
| `npm run format`    | Prettier across the repo                       |

Target a single workspace with `-w`, e.g. `npm run dev -w @prime-kicks/web`.
