# Stage 1: Build Java Applications with Maven
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build

COPY shopify/backend/pom.xml shopify/backend/
COPY admin/backend/pom.xml admin/backend/

# Fetch dependencies (cached layer)
RUN mvn -f shopify/backend/pom.xml dependency:go-offline -B || true
RUN mvn -f admin/backend/pom.xml dependency:go-offline -B || true

COPY shopify/backend/src shopify/backend/src
COPY admin/backend/src admin/backend/src

RUN mvn -f shopify/backend/pom.xml -DskipTests clean package -B
RUN mvn -f admin/backend/pom.xml -DskipTests clean package -B

# Stage 2: Minimal Runtime with Java 21 & Node.js
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache nodejs curl bash

COPY --from=builder /build/shopify/backend/target/hearth-shopify-api-1.0.0.jar /app/shopify-api.jar
COPY --from=builder /build/admin/backend/target/hearth-admin-api-1.0.0.jar /app/admin-api.jar

COPY deploy/render/gateway.js /app/gateway.js
COPY deploy/render/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Persistent storage folder for H2 database and uploads
VOLUME /app/data

EXPOSE 10000 8080 8081

ENTRYPOINT ["/app/entrypoint.sh"]
