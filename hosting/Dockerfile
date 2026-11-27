# OpenCode web app in Docker: builds the CLI (with the web UI embedded) from this repository and runs
# `opencode serve` on all interfaces so the app is reachable from the local network.
#
#   docker build -f hosting/Dockerfile -t material-opencode .
#   docker run -p 4096:4096 -e OPENCODE_PASSWORD=... -v opencode-data:/data -v "$PWD":/workspace material-opencode

FROM oven/bun:1.4.4 AS build
WORKDIR /src
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY . .
RUN bun install --frozen-lockfile
RUN cd packages/cli \
  && bun run build --single --skip-install \
  && mkdir -p /out \
  && cp dist/cli-linux-*/bin/opencode /out/opencode \
  && /out/opencode --version

FROM debian:bookworm-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="Material OpenCode" \
  org.opencontainers.image.description="OpenCode with the Material Expressive web app, served on the local network" \
  org.opencontainers.image.source="https://github.com/Ding-Ding-Projects/material-opencode" \
  org.opencontainers.image.version="${VERSION}"
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git ripgrep curl tini openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1000 opencode \
  && mkdir -p /data /workspace \
  && chown opencode:opencode /data /workspace
COPY --from=build /out/opencode /usr/local/bin/opencode
USER opencode
ENV HOME=/data \
  XDG_CONFIG_HOME=/data/config \
  XDG_DATA_HOME=/data/share \
  XDG_STATE_HOME=/data/state \
  XDG_CACHE_HOME=/data/cache
WORKDIR /workspace
EXPOSE 4096
VOLUME ["/data", "/workspace"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:4096/ | grep -q 200 || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
