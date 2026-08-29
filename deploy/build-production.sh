#!/usr/bin/env sh
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RELEASE_DIR="$REPO_DIR/release"

cd "$REPO_DIR/admin/frontend"
pnpm install --frozen-lockfile --ignore-workspace
pnpm build

cd "$REPO_DIR/shopify/frontend"
pnpm install --frozen-lockfile --ignore-workspace
pnpm build

cd "$REPO_DIR"
mvn -f admin/backend/pom.xml -DskipTests clean package
mvn -f shopify/backend/pom.xml -DskipTests clean package

mkdir -p "$RELEASE_DIR/admin/web" "$RELEASE_DIR/shopify/web"
cp -R "$REPO_DIR/admin/frontend/dist/admin/browser/." "$RELEASE_DIR/admin/web/"
cp -R "$REPO_DIR/shopify/frontend/dist/storefront/." "$RELEASE_DIR/shopify/web/"
cp "$REPO_DIR/admin/backend/target/hearth-admin-api-1.0.0.jar" "$RELEASE_DIR/admin/hearth-admin-api.jar"
cp "$REPO_DIR/shopify/backend/target/hearth-shopify-api-1.0.0.jar" "$RELEASE_DIR/shopify/hearth-shopify-api.jar"

echo "Production artifacts created in $RELEASE_DIR"
