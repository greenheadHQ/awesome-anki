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

RUN bun run --cwd packages/web build

# ---- Stage 3: Production runtime ----
FROM oven/bun:1 AS runtime
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

# Copy built web SPA from builder stage
COPY --from=web-builder /app/packages/web/dist/ packages/web/dist/

# Copy prompt seed files to a separate location (volumes mask /app/output)
COPY output/prompts/ /app/.seed/prompts/

# Create data directories and set ownership
RUN mkdir -p data output/backups output/embeddings output/prompts && \
    chown -R 1001:1001 /app

VOLUME ["/app/data", "/app/output"]

# Entrypoint: seed prompts into volume if empty, then start server
COPY --chmod=755 <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/sh
# Seed prompt files into volume on first run
if [ ! -f /app/output/prompts/active-version.json ] && [ -d /app/.seed/prompts ]; then
  echo "📋 Seeding prompt files into /app/output/prompts/ ..."
  mkdir -p /app/output/prompts/history /app/output/prompts/versions
  cp -rn /app/.seed/prompts/* /app/output/prompts/ 2>/dev/null || true
fi
exec "$@"
ENTRYPOINT

USER anki

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3100) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "packages/server/src/index.ts"]
