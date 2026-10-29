#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root: sudo PLING_RELEASE_DIR=/mnt/plingjs/pling/release ACME_EMAIL=you@example.com $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${PLING_ENV_FILE:-$SCRIPT_DIR/../.env}"
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key raw_value; do
    case "$key" in
      PLING_DOCS_HOST|PLING_WWW_HOST|PLING_DEMO_HOST|PLING_API_HOST|PLING_SURFACE_HOST|PLING_TODO_HOST|PLING_CERT_NAME|PLING_HOSTS|ACME_EMAIL) ;;
      *) continue ;;
    esac
    value="${raw_value%$'\r'}"
    value="${value#\"}"; value="${value%\"}"
    value="${value#\'}"; value="${value%\'}"
    if [[ -z "${!key:-}" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$ENV_FILE"
fi

RELEASE_DIR="${PLING_RELEASE_DIR:-/mnt/plingjs/pling/release}"
ACME_EMAIL="${ACME_EMAIL:-admin@plingjs.dev}"
CERTBOT_SERVER="${CERTBOT_SERVER:-https://acme-v02.api.letsencrypt.org/directory}"
DOCS_HOST="${PLING_DOCS_HOST:-plingjs.dev}"
WWW_HOST="${PLING_WWW_HOST:-www.$DOCS_HOST}"
DEMO_HOST="${PLING_DEMO_HOST:-demo.$DOCS_HOST}"
API_HOST="${PLING_API_HOST:-api.$DOCS_HOST}"
SURFACE_HOST="${PLING_SURFACE_HOST:-surface.$DOCS_HOST}"
TODO_HOST="${PLING_TODO_HOST:-todo.$DOCS_HOST}"
CERT_NAME="${PLING_CERT_NAME:-$DOCS_HOST}"
DEFAULT_HOSTS="$DOCS_HOST,$WWW_HOST,$DEMO_HOST,$API_HOST,$SURFACE_HOST,$TODO_HOST"
IFS=',' read -r -a HOSTS <<< "${PLING_HOSTS:-$DEFAULT_HOSTS}"
for i in "${!HOSTS[@]}"; do
  HOSTS[$i]="$(printf '%s' "${HOSTS[$i]}" | xargs)"
done
CERT_PATH="/etc/letsencrypt/live/$CERT_NAME/fullchain.pem"
ACME_AVAILABLE="/etc/nginx/sites-available/plingjs-acme.conf"
ACME_ENABLED="/etc/nginx/sites-enabled/plingjs-acme.conf"
VHOST_AVAILABLE="/etc/nginx/sites-available/plingjs.conf"
VHOST_ENABLED="/etc/nginx/sites-enabled/plingjs.conf"
HAD_VHOST=0
[[ -L "$VHOST_ENABLED" ]] && HAD_VHOST=1

if [[ ! -f "$RELEASE_DIR/website/index.html" || ! -f "$RELEASE_DIR/demo/demos/quickstart/index.html" ]]; then
  echo "Missing release artifacts under $RELEASE_DIR" >&2
  echo "Build with ./deploy/build.sh and upload deploy/release before running this script." >&2
  exit 1
fi

for host in "${HOSTS[@]}"; do
  if ! getent ahostsv4 "$host" >/dev/null; then
    echo "DNS is not ready: $host has no IPv4 address." >&2
    exit 1
  fi
done

render_config() {
  local source="$1"
  local target="$2"
  sed \
    -e "s|__DOCS_HOST__|$DOCS_HOST|g" \
    -e "s|__WWW_HOST__|$WWW_HOST|g" \
    -e "s|__DEMO_HOST__|$DEMO_HOST|g" \
    -e "s|__API_HOST__|$API_HOST|g" \
    -e "s|__SURFACE_HOST__|$SURFACE_HOST|g" \
    -e "s|__TODO_HOST__|$TODO_HOST|g" \
    -e "s|__CERT_NAME__|$CERT_NAME|g" \
    "$source" > "$target"
  chmod 0644 "$target"
}

cleanup_on_error() {
  local status=$?
  if (( status == 0 )); then
    return
  fi
  rm -f "$ACME_ENABLED"
  if (( HAD_VHOST == 0 )); then
    rm -f "$VHOST_ENABLED"
  fi
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx >/dev/null 2>&1 || true
  fi
  echo "Pling deployment failed; the temporary ACME vhost was removed." >&2
  exit "$status"
}
trap cleanup_on_error EXIT

install -d -m 0755 /srv/pling/website /srv/pling/demo /srv/pling/acme
rsync -a --delete "$RELEASE_DIR/website/" /srv/pling/website/
rsync -a --delete "$RELEASE_DIR/demo/" /srv/pling/demo/

render_config "$SCRIPT_DIR/plingjs-http.conf" "$ACME_AVAILABLE"
ln -sfn "$ACME_AVAILABLE" "$ACME_ENABLED"
nginx -t
systemctl reload nginx

certificate_covers_hosts() {
  [[ -s "$CERT_PATH" ]] || return 1
  local text
  text="$(openssl x509 -in "$CERT_PATH" -noout -text 2>/dev/null)" || return 1
  local host
  for host in "${HOSTS[@]}"; do
    grep -q "DNS:$host" <<< "$text" || return 1
  done
}

if ! certificate_covers_hosts; then
  cert_args=()
  for host in "${HOSTS[@]}"; do
    cert_args+=(-d "$host")
  done
  certbot certonly \
    --server "$CERTBOT_SERVER" \
    --webroot \
    --webroot-path /srv/pling/acme \
    --cert-name "$CERT_NAME" \
    --expand \
    --email "$ACME_EMAIL" \
    --agree-tos \
    --non-interactive \
    "${cert_args[@]}"
fi

render_config "$SCRIPT_DIR/plingjs.conf" "$VHOST_AVAILABLE"
ln -sfn "$VHOST_AVAILABLE" "$VHOST_ENABLED"
rm -f "$ACME_ENABLED"
nginx -t
systemctl reload nginx

echo "Pling Nginx vhosts are installed for ${DOCS_HOST}. Certificate names: ${HOSTS[*]}"
