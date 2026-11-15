#!/bin/sh
set -e

APP_ROLE="${APP_ROLE:-unified}"
PORT="${PORT:-10000}"

echo "Starting The Heating & Plumbing Backend (Role: $APP_ROLE on port $PORT)..."

mkdir -p /app/data/product-images
cd /app

# Safely seed database if missing or empty using node
node -e "const fs = require('fs'); ['hearth_admin.mv.db', 'hearth_shopify.mv.db'].forEach(f => { const target = '/app/data/' + f; const seed = '/app/seed-data/' + f; if (!fs.existsSync(target) || fs.statSync(target).size <= 20480) { if (fs.existsSync(seed)) { fs.copyFileSync(seed, target); console.log('Successfully seeded ' + f + ' (' + fs.statSync(target).size + ' bytes)'); } } });" 2>/dev/null || true
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
  java -Xmx160m -Xms48m \
    -Dspring.profiles.active=h2 \
    -Dserver.port=8081 \
    -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
    com.hearth.admin.AdminApplication > /tmp/admin.log 2>&1 &
  ADMIN_PID=$!

  java -Xmx160m -Xms48m \
    -Dspring.profiles.active=h2 \
    -Dserver.port=8080 \
    -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
    com.hearth.commerce.CommerceApplication > /tmp/store.log 2>&1 &
  STORE_PID=$!

  cleanup() {
    echo "Stopping unified services..."
    kill -TERM "$ADMIN_PID" "$STORE_PID" 2>/dev/null || true
    exit 0
  }
  trap cleanup SIGTERM SIGINT

  exec node /app/gateway.js
fi
