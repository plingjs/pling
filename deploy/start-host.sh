#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Cannot access the Docker daemon. Add this account to the docker group and reconnect." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing $ROOT_DIR/.env" >&2
  exit 1
fi
if [[ ! -f surface.config.json ]]; then
  echo "Missing $ROOT_DIR/surface.config.json" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${PLING_UPSTREAM_BASE_URL:?missing PLING_UPSTREAM_BASE_URL in deploy/.env}"
: "${PLING_UPSTREAM_API_KEY:?missing PLING_UPSTREAM_API_KEY in deploy/.env}"
: "${SURFACE_ADMIN_TOKEN:?missing SURFACE_ADMIN_TOKEN in deploy/.env}"

IMAGE="${PLING_IMAGE:-plingjs:amd64}"
NETWORK="${PLING_NETWORK:-pling-host}"
DOCS_HOST="${PLING_DOCS_HOST:-plingjs.dev}"
SURFACE_HOST="${PLING_SURFACE_HOST:-surface.$DOCS_HOST}"
TODO_HOST="${PLING_TODO_HOST:-todo.$DOCS_HOST}"
SURFACE_PUBLIC_BASE_URL="${SURFACE_PUBLIC_BASE_URL:-https://$SURFACE_HOST}"
TODO_ALLOWED_ORIGINS="${TODO_ALLOWED_ORIGINS:-https://$TODO_HOST}"

if [[ -n "${PLING_IMAGE_TAR:-}" ]]; then
  gzip -dc "$PLING_IMAGE_TAR" | docker load
elif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Image $IMAGE is not loaded. Set PLING_IMAGE_TAR to an image archive." >&2
  exit 1
fi

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network create "$NETWORK" >/dev/null
fi

docker rm -f pling-api pling-surface pling-todo >/dev/null 2>&1 || true

docker run -d \
  --name pling-api \
  --label com.plingjs.service=api \
  --restart unless-stopped \
  --network "$NETWORK" \
  --network-alias api \
  -p 127.0.0.1:5192:5192 \
  --env PLING_UPSTREAM_BASE_URL="$PLING_UPSTREAM_BASE_URL" \
  --env PLING_UPSTREAM_API_KEY="$PLING_UPSTREAM_API_KEY" \
  --env PLING_MODEL="${PLING_MODEL:-}" \
  --env PLING_DEMO_RATE_LIMIT="${PLING_DEMO_RATE_LIMIT:-80}" \
  --env PLING_DEMO_RATE_WINDOW_MS="${PLING_DEMO_RATE_WINDOW_MS:-600000}" \
  --env PLING_TIMEOUT_MS="${PLING_TIMEOUT_MS:-60000}" \
  --env PLING_GATEWAY_HOST=0.0.0.0 \
  --env PLING_GATEWAY_PORT=5192 \
  --env PLING_TRUST_PROXY=1 \
  "$IMAGE" node examples/gateway.mjs >/dev/null

docker run -d \
  --name pling-surface \
  --label com.plingjs.service=surface \
  --restart unless-stopped \
  --network "$NETWORK" \
  --network-alias surface \
  -p 127.0.0.1:5219:5219 \
  --env SURFACE_CONFIG=/etc/pling/surface.json \
  --env SURFACE_ADMIN_TOKEN="$SURFACE_ADMIN_TOKEN" \
  --env SURFACE_PUBLIC_BASE_URL="$SURFACE_PUBLIC_BASE_URL" \
  --env SURFACE_HOST=0.0.0.0 \
  --env SURFACE_PORT=5219 \
  -v "$ROOT_DIR/surface.config.json:/etc/pling/surface.json:ro" \
  "$IMAGE" node services/surface-gateway/src/index.mjs >/dev/null

docker run -d \
  --name pling-todo \
  --label com.plingjs.service=todo \
  --restart unless-stopped \
  --network "$NETWORK" \
  --network-alias todo \
  -p 127.0.0.1:5221:5221 \
  --env NODE_ENV=production \
  --env TODO_BFF_HOST=0.0.0.0 \
  --env TODO_BFF_PORT=5221 \
  --env TODO_DIST=/app/examples/apps/todo-surface-auth/dist \
  --env TODO_ALLOWED_ORIGINS="$TODO_ALLOWED_ORIGINS" \
  --env SURFACE_GATEWAY_URL=http://surface:5219 \
  --env SURFACE_ADMIN_TOKEN="$SURFACE_ADMIN_TOKEN" \
  --env SURFACE_TENANT_ID="${SURFACE_TENANT_ID:-demo}" \
  --env TODO_SURFACE_SCOPES="${TODO_SURFACE_SCOPES:-add_task,toggle@,delete@,clear_completed}" \
  "$IMAGE" node examples/apps/todo-surface-auth/server/index.mjs >/dev/null

check() {
  local name="$1"
  local url="$2"
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      echo "$name: ready"
      return 0
    fi
    sleep 1
  done
  echo "$name: failed to become ready; inspect docker logs $name" >&2
  return 1
}

check pling-api http://127.0.0.1:5192/health
check pling-surface http://127.0.0.1:5219/health
check pling-todo http://127.0.0.1:5221/api/health

echo "Pling services are running on loopback ports 5192, 5219 and 5221."
