# Hearth Admin

Angular 21 admin frontend and Spring Boot 4 / Spring Security backend for the commerce administration scope.

Production deployment instructions are available in the repository-level [`PRODUCTION.md`](../PRODUCTION.md).

## Prerequisites

- Java 21
- Maven 3.9+
- Node.js 20+ and pnpm
- MySQL 8 on `localhost:3306`, user `root`, blank password

Create the database (the backend also attempts to create/update tables):

```sql
CREATE DATABASE IF NOT EXISTS hearth_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Run both applications

```bash
cd admin
pnpm install:frontend
pnpm dev
```

Open <http://localhost:4201>. The dev server proxies `/api` to <http://localhost:8081>.

## Run separately

```bash
cd admin/backend
mvn spring-boot:run
```

```bash
cd admin/frontend
pnpm install --ignore-workspace
pnpm start
```

## Build both applications

```bash
cd admin
pnpm build
```

Admin authentication always reads the user, active status, role and BCrypt password hash from the `admin_users` database table. No default admin credentials are embedded in the frontend or development seed data. For a new production database, provision the first account with the `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_EMAIL`, and `ADMIN_BOOTSTRAP_PASSWORD` environment variables; subsequent logins continue to authenticate against the stored database row.

Database settings can be overridden with `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. JWT signing uses `JWT_SECRET`; set a strong 32+ character value in production.

## Included

- JWT authentication with Spring Security, BCrypt passwords, role checks, stateless sessions, CORS and login throttling
- Actionable dashboard, product catalogue CRUD/archive, customers, quotations, orders/payments, inventory ledger, CMS/reviews, reports and audit log
- Search, status filters, pagination-ready APIs, validation, responsive navigation, loading/empty/error feedback and confirmation dialogs
- MySQL schema managed by JPA and practical seed data for local evaluation

## Terma catalogue workflow

1. Start the storefront (`shopify`) and admin (`admin`) applications.
2. In **Admin → Products**, upload the original Terma `.xlsm`, `.xlsx`, or `.xls` workbook with **Bulk Excel / CSV**. Rows sharing a Terma product code become one product family; each EAN becomes a colour/height/width/panel variant.
3. In Dropbox, download **1. IMAGE LIBRARY & MANUALS - UK STOCK MODELS** as a ZIP, then upload it with **Match image ZIP**. Image filenames beginning with `EAN <barcode>` are matched to the corresponding variant automatically.
4. Manual product creation supports the same EAN-based variant structure.

Admin writes synchronize to the storefront through `SHOPIFY_API_URL` (default `http://localhost:8080`). Both services must use the same strong `CATALOGUE_SYNC_SECRET`. Storefront image requests are proxied to the admin service, so set its `ADMIN_API_URL` when it is not running at `http://localhost:8081`.

The document's explicitly excluded/conditional modules (promotions, returns, notifications, marketplaces, and advanced user/role settings) are not implemented. External payment, carrier, messaging, storage, malware scanning, 2FA provider and marketplace integrations require client-owned credentials and production infrastructure.
