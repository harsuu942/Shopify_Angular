#!/bin/sh
set -e

APP_ROLE="${APP_ROLE:-unified}"
PORT="${PORT:-10000}"

echo "Starting The Heating & Plumbing Backend (Role: $APP_ROLE on port $PORT)..."

mkdir -p /app/data/product-images
cd /app

# Ensure persistent database and product images are populated from seed data
if [ ! -f /app/data/hearth_admin.mv.db ] || [ $(wc -c < /app/data/hearth_admin.mv.db 2>/dev/null || echo 0) -le 20480 ]; then
  echo "Seeding Admin database from /app/seed-data..."
  cp /app/seed-data/hearth_admin.mv.db /app/data/hearth_admin.mv.db 2>/dev/null || true
fi

if [ ! -f /app/data/hearth_shopify.mv.db ] || [ $(wc -c < /app/data/hearth_shopify.mv.db 2>/dev/null || echo 0) -le 20480 ]; then
  echo "Seeding Storefront database from /app/seed-data..."
  cp /app/seed-data/hearth_shopify.mv.db /app/data/hearth_shopify.mv.db 2>/dev/null || true
fi

cp -rn /app/seed-data/product-images/* /app/data/product-images/ 2>/dev/null || true

if [ "$APP_ROLE" = "admin" ]; then
  echo "Launching Admin API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2 \
    -Dserver.port="$PORT" \
    -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
    com.hearth.admin.AdminApplication
elif [ "$APP_ROLE" = "storefront" ]; then
  echo "Launching Storefront API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2 \
    -Dserver.port="$PORT" \
    -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
    com.hearth.commerce.CommerceApplication
else
  echo "Launching Unified Backend (Storefront :8080 + Admin :8081 via Gateway :$PORT)..."
  java -Xmx110m -Xms32m -XX:MaxMetaspaceSize=64m -XX:+UseSerialGC -Xss256k \
    -Dspring.profiles.active=h2 \
    -Dserver.port=8081 \
    -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
    com.hearth.admin.AdminApplication &
  ADMIN_PID=$!

  java -Xmx130m -Xms32m -XX:MaxMetaspaceSize=72m -XX:+UseSerialGC -Xss256k \
    -Dspring.profiles.active=h2 \
    -Dserver.port=8080 \
    -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
    com.hearth.commerce.CommerceApplication &
  STORE_PID=$!

  cleanup() {
    echo "Stopping unified services..."
    kill -TERM "$ADMIN_PID" "$STORE_PID" 2>/dev/null || true
    exit 0
  }
  trap cleanup SIGTERM SIGINT

  exec node /app/gateway.js
fi
