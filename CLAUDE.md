# CLAUDE.md: The Heating & Plumbing (Hearth Commerce)

Guidance for AI agents and engineers working in this repository. Never put secrets in this file.

## Architecture

Two applications, each an Angular 21 frontend plus a Spring Boot 4.1 / Java 21 backend:

```text
admin/
  frontend/   Angular admin UI (single large component in src/main.ts, styles in src/styles.css)
  backend/    Spring Boot admin API, package com.hearth.admin, port 8081
shopify/
  frontend/   Angular storefront (src/main.ts + src/app.component.html + src/styles.css)
  backend/    Spring Boot storefront API, package com.hearth.commerce, port 8080
deploy/
  render/     entrypoint.sh (starts both JARs) and gateway.js (Node gateway on $PORT, /healthz)
  data/       Seed H2 databases + product images baked into the Docker image (tracked on purpose)
  env/        *.env.example only; real admin.env / shopify.env are gitignored
Dockerfile    Builds both backends from source with Maven, then runs the unified container
render.yaml   Render blueprint (unified service, persistent disk at /app/data)
```

Data flow:
- Admin is the source of truth for the catalogue. Saving or archiving a product calls the
  storefront's `POST /api/internal/catalogue/sync`, authenticated with `CATALOGUE_SYNC_SECRET`
  (it must be identical on both backends; a mismatch shows up as `syncStatus=FAILED` / 401).
- The storefront syncs orders, customers, inquiries and reviews back to admin via `/api/internal/**`.
- Checkout uses Stripe with manual capture. Without Stripe keys, payment intents return 503 and
  orders are refused with 402. There is no unpaid order path.
- Variants: `variantSku` is required and unique per product (case-insensitive). `ean` is optional
  (blank becomes null) but unique when present. Checkout matches variants by id.
- Product technical content (overview, included items, features, specs, dimensions, schematic)
  is stored as JSON in `technicalDataJson` and rendered by the storefront PDP tabs.
- Quotations and purchase orders live in admin; customer/vendor email is optional. Print/PDF
  layout is controlled by the `@media print` / `@page` rules in `admin/frontend/src/styles.css`.

## Production topology

- Frontends: Cloudflare Workers with static assets (`wrangler.json` + `worker.js` in each frontend
  folder). The workers serve `dist/` and proxy `/api/*` to the Render backends:
  `hearth-admin-backend.onrender.com`, `hearth-backend-0bbo.onrender.com`.
- Public URLs: `theheatingandplumbing.harsh942-mi.workers.dev` (storefront) and
  `theheatingandplumbing-admin.harsh942-mi.workers.dev` (admin).
- Backends: Render, Docker build from this repo. `render.yaml` has `autoDeployTrigger: commit`,
  so pushing to `main` can deploy the backend. Treat `git push` as a production deploy.
- Production runs both JARs with `spring.profiles.active=h2,render` on H2 files under `/app/data`
  (persistent disk), with `ddl-auto: update`. Anything in `application-h2.yml` therefore applies
  to production: use `${ENV_VAR:local-default}` placeholders, never hard-coded values.
- `PRODUCTION.md` describes an alternative Nginx/systemd/MySQL/PostgreSQL setup that is not the
  current live deployment.

## Build commands

Requirements: Java 21, Maven 3.9+, Node 22 (`.nvmrc`), pnpm 9.

```bash
# Frontends (dist/ output is committed for both apps; commit regenerated bundles with source changes)
cd admin/frontend   && pnpm install --frozen-lockfile --ignore-workspace && pnpm build
cd shopify/frontend && pnpm install --frozen-lockfile --ignore-workspace && pnpm build

# Backends (build + unit tests)
mvn -f admin/backend/pom.xml clean package
mvn -f shopify/backend/pom.xml clean package

# Everything, without tests (release artifacts in release/)
./deploy/build-production.sh
```

Local development (H2, from each app folder): `pnpm install:frontend && pnpm dev`.
Storefront on http://localhost:4200 (API 8080), admin on http://localhost:4201 (API 8081).
Always run local backends with `SPRING_PROFILES_ACTIVE=h2`. The admin's base `application.yml`
defaults `SHOPIFY_API_URL` to the production storefront; the h2 profile points it at localhost.
Demo users are listed in README.md (development only).

## Testing requirements (before any commit that will be deployed)

1. Both frontend production builds succeed with no errors, and the committed `dist/` hashes match
   a fresh build of the committed source.
2. `mvn clean package` succeeds for both backends (runs the JUnit tests in `src/test/java`).
3. Smoke-test locally with both backends on throwaway H2 databases and a non-default
   `CATALOGUE_SYNC_SECRET` set identically on both:
   - product create/update/archive and storefront sync (including a variant without EAN)
   - variant validation (duplicate/missing SKU, duplicate EAN), stock to zero, out-of-stock on storefront
   - quotation and purchase order create/edit without email; print preview of both on A4
   - checkout gating (no order without payment); full card payment only with Stripe test keys
4. Schema changes: `ddl-auto: update` adds columns but never relaxes constraints. Changes such as
   NOT NULL to nullable need an explicit idempotent migration
   (see `VariantEanNullableMigration` in both backends). Test against a copy of `deploy/data/*.mv.db`.

## Deployment rules

- Deploy only after the testing requirements pass locally. Show the commit list and deploy plan
  to the owner and get approval before pushing or running `wrangler deploy`.
- Order: push backend (Render) and wait for health, then deploy the storefront worker, then the admin worker.
- After every deployment, verify:
  - `https://hearth-admin-backend.onrender.com/actuator/health`: `{"status":"UP"}`
  - `https://hearth-backend-0bbo.onrender.com/actuator/health`: `{"status":"UP"}`
  - `https://theheatingandplumbing.harsh942-mi.workers.dev/actuator/health` (through the worker)
  - Storefront home and a product page load; admin login page loads.
- Roll back by redeploying the previous commit on Render / `wrangler rollback`; never by editing data.

## Safety constraints

- Never commit or print secrets: Stripe keys, JWT secrets, SMTP or database passwords,
  `CATALOGUE_SYNC_SECRET`, admin bootstrap credentials, real `.env` files. Production values live
  in Render/Cloudflare environment settings (`sync: false` / `generateValue` in render.yaml).
- Scan staged changes for secret patterns before every commit. The Google Places browser key in
  `shopify/frontend/src/main.ts` is public by design and must stay HTTP-referrer restricted.
- Never delete or overwrite production data, the persistent disk, or `deploy/data/*.mv.db` without
  explicit approval. Work on copies when testing against seed data.
- Existing uncommitted changes in the working tree are intentional. Do not discard, reset or stash
  them without asking.
- Do not point a local admin at the production storefront (keep the h2 profile or set `SHOPIFY_API_URL`).
