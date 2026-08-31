# MVP single-stage image — build context is backend/ (npm workspace root).
# Builds all 3 services in every image (redundant, accepted for speed of
# writing). No --omit=dev / selective copy: the multi-stage, production-sized
# image is a documented follow-up, not done here.
FROM node:22-bookworm-slim

# Prisma's query/schema engine binaries need libssl at runtime; bookworm-slim
# ships neither. Without this, migrate/generate fail with an empty
# "Schema engine error:" and no further detail.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

WORKDIR /app/services/glucose-service
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s CMD ["node", "-e", "fetch('http://localhost:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
