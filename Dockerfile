# syntax=docker/dockerfile:1

###############################################################################
# Single image that runs BOTH the OpenBao server and our Next.js BFF/UI.
#   - OpenBao listens internally on 127.0.0.1:8200
#   - Next.js (standalone) listens on 0.0.0.0:3000 and is the only exposed port
#   - Next proxies /v1/* to OpenBao (see next.config.ts rewrites)
###############################################################################

# --- Stage 1: install dependencies ------------------------------------------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# --- Stage 2: build the Next.js standalone output ---------------------------
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Stage 3: runtime (Node + the OpenBao binary) ---------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV OPENBAO_ADDR=http://127.0.0.1:8200
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# tini for clean signal handling / zombie reaping (we run two processes).
RUN apk add --no-cache tini ca-certificates wget

# Pull the `bao` binary from the official OpenBao image — no separate container.
COPY --from=quay.io/openbao/openbao:latest /bin/bao /usr/local/bin/bao

# Next.js standalone server + static assets.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# OpenBao config + process supervisor.
COPY docker/openbao.hcl /bao/config/openbao.hcl
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /bao/file \
  && addgroup -S bao && adduser -S bao -G bao \
  && chown -R bao:bao /bao /app

# Dev mode is the default so login works out of the box; disable for production.
ENV BAO_DEV=1
ENV BAO_DEV_ROOT_TOKEN_ID=root

EXPOSE 3000
USER bao

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
