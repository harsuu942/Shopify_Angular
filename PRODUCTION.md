# Production deployment without Docker

This runbook deploys both Angular applications as static files behind Nginx and both Spring Boot APIs as `systemd` services. Spring Boot supports external environment configuration and standard service management in this model.

## Architecture

```text
Internet → Nginx/TLS
             ├── shop.example.com  → /var/www/hearth/shopify + 127.0.0.1:8080
             └── admin.example.com → /var/www/hearth/admin   + 127.0.0.1:8081

Shopify API → PostgreSQL
Admin API   → MySQL
```

Only ports 80 and 443 should be public. Keep ports 8080, 8081, 3306 and 5432 restricted to localhost/private networks.

## 1. Server requirements

Install on a supported Linux server:

- Java 21
- Maven 3.9+
- Node.js 22 and pnpm
- Nginx
- MySQL 8 for Admin
- PostgreSQL 16+ for Shopify
- Certbot or another TLS certificate manager

Create an unprivileged service account and deployment directories:

```bash
sudo useradd --system --home /opt/hearth --shell /usr/sbin/nologin hearth
sudo mkdir -p /opt/hearth/admin /opt/hearth/shopify /var/www/hearth/admin /var/www/hearth/shopify /var/lib/hearth-admin/product-images /etc/hearth
sudo chown -R hearth:hearth /opt/hearth
sudo chown -R hearth:hearth /var/lib/hearth-admin
sudo chown -R www-data:www-data /var/www/hearth
```

## 2. Create databases

Create a dedicated MySQL database/user for Admin and a dedicated PostgreSQL database/user for Shopify. Grant each user access only to its own database. Require TLS when the database is on another host.

For a new database only, use `DDL_MODE=update` during the first application startup. After tables are created, change it to `DDL_MODE=validate`. Use reviewed versioned database migrations for subsequent releases.

## 3. Build release artifacts

On the build server or CI runner:

```bash
cd /path/to/Shopify_Angular
chmod +x deploy/build-production.sh
./deploy/build-production.sh
```

The script produces:

```text
release/
├── admin/
│   ├── hearth-admin-api.jar
│   └── web/
└── shopify/
    ├── hearth-shopify-api.jar
    └── web/
```

Copy the artifacts to the production server:

```bash
sudo install -o hearth -g hearth -m 0750 release/admin/hearth-admin-api.jar /opt/hearth/admin/hearth-admin-api.jar
sudo install -o hearth -g hearth -m 0750 release/shopify/hearth-shopify-api.jar /opt/hearth/shopify/hearth-shopify-api.jar
sudo rsync -a --delete release/admin/web/ /var/www/hearth/admin/
sudo rsync -a --delete release/shopify/web/ /var/www/hearth/shopify/
```

## 4. Configure production secrets

```bash
sudo cp deploy/env/admin.env.example /etc/hearth/admin.env
sudo cp deploy/env/shopify.env.example /etc/hearth/shopify.env
sudo chmod 600 /etc/hearth/admin.env /etc/hearth/shopify.env
sudo chown root:root /etc/hearth/admin.env /etc/hearth/shopify.env
```

Replace every `CHANGE_ME`. Generate secrets with:

```bash
openssl rand -base64 48
```

Important:

- `JWT_SECRET` must contain at least 32 random characters.
- `ADMIN_PUBLIC_URL` must exactly match the public HTTPS admin origin.
- The production profile disables demo seed data.
- A new Admin database creates its first administrator from `ADMIN_BOOTSTRAP_*`; the password must contain at least 12 characters.
- The bootstrap account is not overwritten after the first startup.

## 5. Install services

```bash
sudo cp deploy/systemd/hearth-admin.service /etc/systemd/system/
sudo cp deploy/systemd/hearth-shopify.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hearth-admin hearth-shopify
```

Check them:

```bash
sudo systemctl status hearth-admin hearth-shopify
sudo journalctl -u hearth-admin -u hearth-shopify --since "10 minutes ago"
curl -fsS http://127.0.0.1:8081/actuator/health
curl -fsS http://127.0.0.1:8080/actuator/health
```

## 6. Configure Nginx and HTTPS

Edit `deploy/nginx/hearth.conf` and replace:

- `shop.example.com`
- `admin.example.com`
- certificate paths if your certificate manager uses different paths

Install and validate it:

```bash
sudo cp deploy/nginx/hearth.conf /etc/nginx/sites-available/hearth.conf
sudo cp deploy/nginx/rate-limits.conf /etc/nginx/conf.d/hearth-rate-limits.conf
sudo ln -s /etc/nginx/sites-available/hearth.conf /etc/nginx/sites-enabled/hearth.conf
sudo nginx -t
sudo systemctl reload nginx
```

The supplied Nginx configuration applies per-IP request and connection limits, a stricter Admin login limit, request-body limits, TLS-only redirects and browser security headers. The APIs also enforce an application-level fallback limit. In a multi-instance deployment, replace the in-memory application fallback with a shared limiter such as Redis or an API gateway.

Issue TLS certificates using your selected certificate provider before enabling the HTTPS server blocks. Configure automatic certificate renewal.

## 7. Deploy an update

Build a new release, back up both databases, then copy artifacts and restart:

```bash
sudo systemctl stop hearth-admin hearth-shopify
sudo install -o hearth -g hearth -m 0750 release/admin/hearth-admin-api.jar /opt/hearth/admin/hearth-admin-api.jar
sudo install -o hearth -g hearth -m 0750 release/shopify/hearth-shopify-api.jar /opt/hearth/shopify/hearth-shopify-api.jar
sudo rsync -a --delete release/admin/web/ /var/www/hearth/admin/
sudo rsync -a --delete release/shopify/web/ /var/www/hearth/shopify/
sudo systemctl start hearth-admin hearth-shopify
sudo nginx -t && sudo systemctl reload nginx
```

Retain the previous JARs and static assets until the new version passes health and functional checks. Roll back by restoring those artifacts and restarting both services.

## 8. Production verification

- Confirm both actuator health endpoints report `UP`.
- Confirm HTTP redirects to HTTPS.
- Test storefront browsing, login, cart and order submission.
- Test Admin login, product pagination, search, details and editing.
- Confirm unauthorized API requests return `401` or `403`.
- Restart both services and verify recovery.
- Check Nginx and system journals for errors.
- Test database backup restoration before launch.

## 9. Operational requirements

- Automate encrypted, off-server database backups and restoration tests.
- Configure centralized logs, uptime checks and disk/CPU/memory alerts.
- Restrict SSH, database and backend ports with a firewall.
- Run dependency and application security scans in CI.
- Keep Java, Node, Nginx, MySQL and PostgreSQL patched.
- Connect a real payment provider before accepting payments; the current checkout does not process card data.
- Review privacy, tax, retention, returns and accessibility requirements for the launch jurisdiction.

References: [Spring Boot systemd deployment](https://docs.spring.io/spring-boot/how-to/deployment/installing.html), [Spring Boot external configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html), and [Nginx request routing](https://nginx.org/en/docs/http/ngx_http_core_module.html).
