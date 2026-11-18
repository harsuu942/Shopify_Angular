FROM maven:3.9-eclipse-temurin-21-alpine AS backend-build
WORKDIR /build

# Cache dependencies independently for the two Spring applications, then build
# from source.  Production previously copied deploy/render/apps, which could be
# stale even when source code had changed.
COPY admin/backend/pom.xml admin/backend/pom.xml
COPY shopify/backend/pom.xml shopify/backend/pom.xml
RUN mvn -q -f admin/backend/pom.xml dependency:go-offline \
 && mvn -q -f shopify/backend/pom.xml dependency:go-offline
COPY admin/backend/src admin/backend/src
COPY shopify/backend/src shopify/backend/src
RUN mvn -q -f admin/backend/pom.xml -DskipTests package \
 && mvn -q -f shopify/backend/pom.xml -DskipTests package

# Minimal Runtime with Java 21 & Node.js
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache nodejs curl bash

COPY --from=backend-build /build/admin/backend/target/hearth-admin-api-1.0.0.jar /app/admin.jar
COPY --from=backend-build /build/shopify/backend/target/hearth-shopify-api-1.0.0.jar /app/storefront.jar

COPY deploy/render/gateway.js /app/gateway.js
COPY deploy/render/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Pre-populate persistent storage folder with full catalogue H2 databases and product images
COPY deploy/data /app/seed-data
COPY deploy/data /app/data
VOLUME /app/data

EXPOSE 10000 8080 8081

ENTRYPOINT ["/app/entrypoint.sh"]
