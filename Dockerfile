# syntax=docker/dockerfile:1

# --- Frontend build stage ----------------------------------------------
FROM node:24-alpine AS fe-build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Pin pnpm to the version that generated the lockfile (10.x). `corepack enable`
# alone would pull the latest (11.x), whose supply-chain policy
# (MINIMUM_RELEASE_AGE) rejects recently-published lockfile entries.
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate && pnpm install --frozen-lockfile

COPY . .

# Injected at build time by CI (hardcoded defaults for local builds).
ARG VITE_APP_VERSION=Nightly
ARG VITE_SITE_URL=https://bundlestate.dimasbaguspm.dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_SITE_URL=$VITE_SITE_URL

RUN pnpm build

# --- Go deploy binary build stage --------------------------------------
FROM golang:1.23-alpine AS go-build
WORKDIR /src
# Cache module downloads
COPY deploy/go.mod deploy/go.sum* ./
RUN cd deploy && go mod download 2>/dev/null || true
COPY deploy/ ./
# Build a static binary that serves the SPA on :80 with catch-all routing.
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/bundlestate-server ./cmd/bundlestate-server

# --- Serve stage --------------------------------------------------------
FROM alpine:3.20

# ca-certs for any outbound TLS the server may do; wget for the healthcheck.
RUN apk add --no-cache wget ca-certificates

WORKDIR /app
COPY --from=fe-build /app/dist /app/dist
COPY --from=go-build /out/bundlestate-server /usr/local/bin/bundlestate-server

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:80/healthz >/dev/null || exit 1

# The Golang binary serves the SPA (catch-all routing for client-side routes)
# and listens on port 80.
CMD ["bundlestate-server", "serve", "--addr", ":80", "--dir", "/app/dist"]
