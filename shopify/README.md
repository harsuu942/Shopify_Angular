# Hearth Shopify Storefront

The customer-facing application is split into two independently runnable projects:

```text
shopify/
├── frontend/   Angular 21 storefront
└── backend/    Spring Boot API
```

Production deployment instructions are available in the repository-level [`PRODUCTION.md`](../PRODUCTION.md).

## Run both applications

Requirements: Java 21+, Maven 3.9+, Node.js 22+ and pnpm.

```bash
cd shopify
pnpm install:frontend
pnpm dev
```

The frontend runs at <http://localhost:4200> and proxies `/api` requests to the backend at <http://localhost:8080>.

## Run separately

```bash
cd shopify/backend
mvn spring-boot:run
```

```bash
cd shopify/frontend
pnpm install --ignore-workspace
pnpm start
```

## Build

From `shopify/`:

```bash
pnpm build
```

Build output is written to `shopify/frontend/dist/storefront` and `shopify/backend/target`.
