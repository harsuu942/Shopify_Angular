#!/bin/sh
set -e

APP_ROLE="${APP_ROLE:-unified}"
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
elif [ "$APP_ROLE" = "storefront" ]; then
  echo "Launching Storefront API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2 \
    -Dserver.port="$PORT" \
    -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
    com.hearth.commerce.CommerceApplication
else
  echo "Launching Unified Backend (Storefront :8080 + Admin :8081 via Gateway :$PORT)..."
  java -Xmx176m -Xms48m \
    -Dspring.profiles.active=h2 \
    -Dserver.port=8081 \
    -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
    com.hearth.admin.AdminApplication &
  ADMIN_PID=$!

  java -Xmx176m -Xms48m \
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
