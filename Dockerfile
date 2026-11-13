# Minimal Runtime with Java 21 & Node.js
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache nodejs curl bash

COPY deploy/render/apps/shopify /app/shopify
COPY deploy/render/apps/admin /app/admin

COPY deploy/render/gateway.js /app/gateway.js
COPY deploy/render/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Persistent storage folder for H2 database and uploads
VOLUME /app/data

EXPOSE 10000 8080 8081

ENTRYPOINT ["/app/entrypoint.sh"]
