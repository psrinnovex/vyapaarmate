# Local Responsive QA

Use this flow to run the Chrome responsive audit against a local VyapaarMate app with real authenticated sessions. The audit defaults to `http://localhost:3000`; set `RESPONSIVE_BASE_URL` when the app is running on a different local origin.

This flow does not bypass auth, RBAC, `proxy.ts`, or protected route checks. Protected routes are audited with real signed `vyapaarmate_session` cookies. A `401`, `403`, or redirect to `/login` is a real audit failure.

Do not seed responsive audit fixtures into hosted Supabase by default. The seed script refuses any `DATABASE_URL` host that is not `localhost`, `127.0.0.1`, `::1`, or `0.0.0.0`.

Before Chrome launches, the audit verifies that the `RESPONSIVE_*` IDs exist in the same `DATABASE_URL` used by `npm run dev`. This is required because protected pages call the real session API, which revalidates the signed cookie against the `User` table.

## Authenticated Audit Data

Protected routes use the real app session format:

- Cookie name: `vyapaarmate_session`
- JWT algorithm: `HS256`
- JWT secret: `JWT_SECRET`
- JWT subject: local `User.id`
- JWT payload: `name`, `email`, `role`, `businessId`
- Expiry: `7d`
- Owner access: local owner user has `role=OWNER` and the seeded audit business ID
- Admin access: local admin user has `role=SUPER_ADMIN`
- Support access: local support user has `role=SUPPORT_AGENT`

The seed script creates fake local audit data only:

- `audit.owner@example.test`
- `audit.admin@example.test`
- `audit.support@example.test`
- `Audit Business`

It prints export commands for:

```sh
export RESPONSIVE_OWNER_USER_ID=...
export RESPONSIVE_OWNER_BUSINESS_ID=...
export RESPONSIVE_ADMIN_USER_ID=...
export RESPONSIVE_SUPPORT_USER_ID=...
```

Export those IDs in the shell that runs `scripts/qa/responsive-audit.mjs`.

The audit rejects missing IDs, placeholder-looking IDs, IDs that do not exist in the connected database, and IDs that point to the wrong role or business.

## Path A - Supabase Local

Requires Docker and the Supabase CLI. The Supabase CLI docs show `supabase start` launching the local stack and printing the local Postgres URL.

```sh
npx supabase start
npx supabase status
```

Copy the local database URL printed by `npx supabase status`. The default local Supabase DB URL is usually:

```sh
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
export DIRECT_URL="$DATABASE_URL"
```

Keep both `DATABASE_URL` and `DIRECT_URL` local before running Prisma migrations. This repo's Prisma schema has `directUrl = env("DIRECT_URL")`, so leaving `DIRECT_URL` pointed at hosted Supabase can make migrations use the wrong database.

Export the same `JWT_SECRET` used by the local app. This reads only the JWT secret through Next's env loader and does not source the whole `.env.local` file:

```sh
export JWT_SECRET="$(node -e 'const { loadEnvConfig } = require("@next/env"); const env = loadEnvConfig(process.cwd()).combinedEnv; process.stdout.write(env.JWT_SECRET || "");')"
```

If `JWT_SECRET` is empty or still a placeholder, set a 32+ character local value in `.env.local` first.

Run migrations, generate Prisma Client, and seed the local audit users:

```sh
npx prisma migrate deploy
npx prisma generate
node scripts/seed-responsive-audit-users.mjs
```

Copy and run the `export RESPONSIVE_*` lines printed by the seed script.

Start the local app in a terminal that has the same local `DATABASE_URL`, local `DIRECT_URL`, and `JWT_SECRET` exports:

```sh
npm run dev
```

Run the authenticated responsive audit from another terminal with the same `JWT_SECRET` and the printed `RESPONSIVE_*` IDs:

```sh
RESPONSIVE_BASE_URL=http://localhost:3000 RESPONSIVE_ROUTES=/dashboard,/dashboard/orders,/dashboard/menu,/dashboard/payments,/admin,/admin/payments,/admin/support,/support node scripts/qa/responsive-audit.mjs
```

If the default local Supabase `postgres` database is already non-empty from another local project, do not point the audit at hosted Supabase. Create an isolated database inside the local Supabase Postgres container, keep the host on `127.0.0.1`, and use that database for both `DATABASE_URL` and `DIRECT_URL` before running Prisma, the seed, the dev server, and the audit.

## Latest Verified Local Run

Status: Protected responsive audit passed against local seeded database.

Verified on 2026-07-03 with:

- Local Supabase Postgres on `127.0.0.1:54322`
- Isolated local audit database inside the local Supabase Postgres container
- Real `vyapaarmate_session` JWT cookies signed with the local `JWT_SECRET`
- Seeded owner, admin, and support audit users from `scripts/seed-responsive-audit-users.mjs`
- Routes: `/dashboard`, `/dashboard/orders`, `/dashboard/menu`, `/dashboard/payments`, `/admin`, `/admin/payments`, `/admin/support`, `/support`
- Viewports: 320, 375, 390, 430, 768, 1024, 1280, 1440

Result:

- Hard failures: 0
- Auth redirects to `/login`: 0
- Cookie stored and sent for protected document requests: yes
- Warnings: tall phone content blocks on admin/support pages; no horizontal overflow or clipped controls were reported.

## Path B - Local PostgreSQL

Use this path when you want a plain local Postgres database instead of the Supabase local stack.

Create a local database:

```sh
createdb bhojzo_responsive_qa
```

Point Prisma at that local database. Replace the username and password with your local Postgres credentials:

```sh
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/bhojzo_responsive_qa?schema=public"
export DIRECT_URL="$DATABASE_URL"
```

The seed guard accepts `localhost`, `127.0.0.1`, `::1`, and `0.0.0.0` only.

Export the same `JWT_SECRET` used by the local app:

```sh
export JWT_SECRET="$(node -e 'const { loadEnvConfig } = require("@next/env"); const env = loadEnvConfig(process.cwd()).combinedEnv; process.stdout.write(env.JWT_SECRET || "");')"
```

Run migrations, generate Prisma Client, and seed the local audit users:

```sh
npx prisma migrate deploy
npx prisma generate
node scripts/seed-responsive-audit-users.mjs
```

Copy and run the printed `export RESPONSIVE_*` lines, start the local app with the same local DB and JWT env, then run:

```sh
RESPONSIVE_BASE_URL=http://localhost:3000 RESPONSIVE_ROUTES=/dashboard,/dashboard/orders,/dashboard/menu,/dashboard/payments,/admin,/admin/payments,/admin/support,/support node scripts/qa/responsive-audit.mjs
```

## Remote Refusal And Disposable Staging Override

If `DATABASE_URL` points at a hosted Supabase pooler such as `aws-1-ap-northeast-2.pooler.supabase.com`, the seed script refuses to run and prints:

- the detected DB host
- why the write was refused
- the local Supabase setup commands
- the disposable staging override format

The old one-variable bypass is not used. A remote write requires both env vars below, and the confirmed host must exactly match the detected DB host:

```sh
ALLOW_RESPONSIVE_AUDIT_REMOTE_SEED=1 RESPONSIVE_AUDIT_CONFIRM_REMOTE_HOST=exact-host.example.com node scripts/seed-responsive-audit-users.mjs
```

Use the override only for a disposable staging database that can be deleted. Never use it for production or a shared hosted Supabase database.

## Audit Output

For each route and viewport the audit prints:

- target route
- expected role
- final URL
- document status
- pass/fail reason
- cookie diagnostics when a protected route redirects

The audit rejects missing values and obvious placeholder-looking values before launching Chrome.
