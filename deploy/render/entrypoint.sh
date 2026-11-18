#!/bin/sh
set -e

APP_ROLE="${APP_ROLE:-unified}"
PORT="${PORT:-10000}"

echo "Starting The Heating & Plumbing Backend (Role: $APP_ROLE on port $PORT)..."

mkdir -p /app/data/product-images
cd /app

# In the unified service both APIs share the same container.  Always use the
# loopback addresses for service-to-service sync; routing those calls through
# the public Worker/Render URL made catalogue updates depend on DNS, CORS and
# the gateway's public route classification.
if [ "$APP_ROLE" = "unified" ]; then
  export SHOPIFY_API_URL="${SHOPIFY_API_URL:-http://127.0.0.1:8080}"
  export ADMIN_API_URL="${ADMIN_API_URL:-http://127.0.0.1:8081}"
fi

# Safely seed database if missing or empty using node
node -e "const fs = require('fs'); ['hearth_admin.mv.db', 'hearth_shopify.mv.db'].forEach(f => { const target = '/app/data/' + f; const seed = '/app/seed-data/' + f; if (!fs.existsSync(target) || fs.statSync(target).size <= 20480) { if (fs.existsSync(seed)) { fs.copyFileSync(seed, target); console.log('Successfully seeded ' + f + ' (' + fs.statSync(target).size + ' bytes)'); } } });" 2>/dev/null || true
cp -rn /app/seed-data/product-images/* /app/data/product-images/ 2>/dev/null || true

if [ "$APP_ROLE" = "admin" ]; then
  echo "Launching Admin API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2,render \
    -Dserver.port="$PORT" \
    -jar /app/admin.jar
elif [ "$APP_ROLE" = "storefront" ]; then
  echo "Launching Storefront API on port $PORT..."
  exec java -Xmx256m -Xms64m \
    -Dspring.profiles.active=h2,render \
    -Dserver.port="$PORT" \
    -jar /app/storefront.jar
else
  echo "Launching Unified Backend (Storefront :8080 + Admin :8081 via Gateway :$PORT)..."
  java -Xmx160m -Xms48m \
    -Dspring.profiles.active=h2,render \
    -Dserver.port=8081 \
    -jar /app/admin.jar > /tmp/admin.log 2>&1 &
  ADMIN_PID=$!

  java -Xmx160m -Xms48m \
    -Dspring.profiles.active=h2,render \
    -Dserver.port=8080 \
    -jar /app/storefront.jar > /tmp/store.log 2>&1 &
  STORE_PID=$!

  cleanup() {
    echo "Stopping unified services..."
    kill -TERM "$ADMIN_PID" "$STORE_PID" 2>/dev/null || true
    exit 0
  }
  trap cleanup SIGTERM SIGINT

  exec node /app/gateway.js
fi
