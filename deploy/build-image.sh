#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE="${PLING_IMAGE:-plingjs:runtime}"
PLATFORM="${PLING_PLATFORM:-linux/amd64}"
NODE_IMAGE="${PLING_NODE_IMAGE:-node:22-alpine}"
ENV_FILE="${PLING_ENV_FILE:-$ROOT_DIR/deploy/.env}"
VITE_AGENT_BASE_URL="${VITE_AGENT_BASE_URL:-/api/agent/v1}"
VITE_AGENT_MODEL="${VITE_AGENT_MODEL:-}"

if [[ -z "$VITE_AGENT_MODEL" && -f "$ENV_FILE" ]]; then
  VITE_AGENT_MODEL="$(awk -F= '$1 == "PLING_MODEL" { value = substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE")"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

docker buildx build \
  --platform "$PLATFORM" \
  --target runtime \
  --file deploy/Dockerfile \
  --tag "$IMAGE" \
  --build-arg NODE_IMAGE="$NODE_IMAGE" \
  --build-arg VITE_AGENT_BASE_URL="$VITE_AGENT_BASE_URL" \
  --build-arg VITE_AGENT_MODEL="$VITE_AGENT_MODEL" \
  --load \
  .

docker run --rm --platform "$PLATFORM" --entrypoint node "$IMAGE" --version

if [[ -n "${PLING_IMAGE_TAR:-}" ]]; then
  docker save "$IMAGE" | gzip -9 > "$PLING_IMAGE_TAR"
  echo "Exported $IMAGE to $PLING_IMAGE_TAR"
fi
