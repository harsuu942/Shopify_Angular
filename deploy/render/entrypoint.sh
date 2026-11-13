#!/bin/sh
set -e

APP_ROLE="${APP_ROLE:-storefront}"
PORT="${PORT:-10000}"

echo "Starting The Heating & Plumbing Backend (Role: $APP_ROLE on port $PORT)..."

mkdir -p /app/data/product-images
cd /app

if [ "$APP_ROLE" = "admin" ]; then
  echo "Launching Admin API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2 \
    -Dserver.port="$PORT" \
    -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
    com.hearth.admin.AdminApplication
else
  echo "Launching Storefront API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2 \
    -Dserver.port="$PORT" \
    -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
    com.hearth.commerce.CommerceApplication
fi
