# ---- Stage 1: Install all dependencies ----
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lockb ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN bun install --frozen-lockfile

# ---- Stage 2: Build web SPA ----
FROM deps AS web-builder
WORKDIR /app

COPY packages/core/ packages/core/
COPY packages/web/ packages/web/
COPY tsconfig.json ./

RUN bun run --cwd packages/web build

# ---- Stage 3: Production runtime ----
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --gid 1001 anki && \
    adduser --uid 1001 --gid 1001 --disabled-password --gecos "" anki

# Copy package manifests and install production-only deps
COPY package.json bun.lockb ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN bun install --frozen-lockfile --production

# Copy source (core + server)
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
COPY tsconfig.json ./

# Copy built web SPA from builder stage
COPY --from=web-builder /app/packages/web/dist/ packages/web/dist/

# Copy prompt templates (file-based SoT, actively used)
COPY output/prompts/ output/prompts/

# Create data directories and set ownership
RUN mkdir -p data output/backups output/embeddings && \
    chown -R 1001:1001 /app

VOLUME ["/app/data", "/app/output"]

USER anki

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3100) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "run", "packages/server/src/index.ts"]
