#!/bin/sh
set -e

echo "Starting The Heating & Plumbing Unified Cloud Backend..."

cd /app
mkdir -p /app/data/product-images

# 1. Start Admin API (port 8081)
java -Xmx192m -Xms64m \
  -Dspring.profiles.active=h2 \
  -Dserver.port=8081 \
  -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
  com.hearth.admin.AdminApplication &
ADMIN_PID=$!
echo "✓ Admin Backend started (PID $ADMIN_PID) on port 8081"

# 2. Start Storefront API (port 8080)
java -Xmx192m -Xms64m \
  -Dspring.profiles.active=h2 \
  -Dserver.port=8080 \
  -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
  com.hearth.commerce.CommerceApplication &
STORE_PID=$!
echo "✓ Storefront Backend started (PID $STORE_PID) on port 8080"

# Trap shutdown signals
cleanup() {
  echo "Stopping services..."
  kill -TERM "$ADMIN_PID" "$STORE_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# 3. Start Node Gateway on Render $PORT
exec node /app/gateway.js
