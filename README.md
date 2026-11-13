# Hearth & Home Commerce

This repository contains two applications, each split into an Angular frontend and Spring Boot backend:

```text
admin/
├── frontend/
└── backend/
shopify/
├── frontend/
└── backend/
```

The admin catalogue supports manual products, direct Terma Excel imports, EAN/barcode variants, and EAN-based image matching from a downloaded Dropbox image-library ZIP. Published changes synchronize to the customer storefront.

For production deployment with Nginx and `systemd`, including security configuration, verification, backups and rollout steps, see [PRODUCTION.md](PRODUCTION.md).

## Run locally

Requirements: Java 21+, Maven 3.9+, Node 22+ and pnpm 10+.

```bash
cd shopify
pnpm install:frontend
pnpm dev
```

The Angular app runs at `http://localhost:4200` and proxies `/api` to Spring Boot
on `http://localhost:8080`.

Demo users:

- Customer: `customer@example.com` / `Customer123!`
- Administrator: `admin@example.com` / `Admin123!`

## Production build

```bash
cd shopify
pnpm build
java -jar backend/target/hearth-shopify-api-1.0.0.jar
```

## Configuration

Development uses an in-memory H2 database. For production, set
`SPRING_PROFILES_ACTIVE=prod`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and
`JWT_SECRET` (at least 32 random bytes). Payment, Shopify and marketplace
connections live behind adapter boundaries and require merchant credentials.
