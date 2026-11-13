#!/bin/sh
set -e

echo "Starting The Heating & Plumbing Unified Cloud Backend..."

cd /app
mkdir -p /app/data/product-images

# 1. Start Node Gateway immediately so Render health check passes right away
node /app/gateway.js &
GW_PID=$!
echo "✓ Unified Gateway started (PID $GW_PID)"

# 2. Start Storefront API (port 8080) with memory optimizations
java -Xmx140m -Xms32m -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -Xss256k \
  -Dspring.profiles.active=h2 \
  -Dserver.port=8080 \
  -cp "/app/shopify/BOOT-INF/classes:/app/shopify/BOOT-INF/lib/*" \
  com.hearth.commerce.CommerceApplication &
STORE_PID=$!
echo "✓ Storefront Backend started (PID $STORE_PID) on port 8080"

# 3. Wait for Storefront to finish class loading before starting Admin to stay under 512MB RAM
echo "Staggering startup to preserve memory..."
sleep 25

# 4. Start Admin API (port 8081) with memory optimizations
java -Xmx140m -Xms32m -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -Xss256k \
  -Dspring.profiles.active=h2 \
  -Dserver.port=8081 \
  -cp "/app/admin/BOOT-INF/classes:/app/admin/BOOT-INF/lib/*" \
  com.hearth.admin.AdminApplication &
ADMIN_PID=$!
echo "✓ Admin Backend started (PID $ADMIN_PID) on port 8081"

# Trap shutdown signals
cleanup() {
  echo "Stopping all services..."
  kill -TERM "$ADMIN_PID" "$STORE_PID" "$GW_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

wait $GW_PID
