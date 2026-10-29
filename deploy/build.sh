#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/deploy/release"

cd "$ROOT"
pnpm install --frozen-lockfile
pnpm --filter @plingjs/website build
pnpm --filter @plingjs/example-todo-surface-auth build

rm -rf "$OUT"
mkdir -p "$OUT"
cp -R website/.vitepress/dist "$OUT/website"
mkdir -p "$OUT/demo"
cp -R website/.vitepress/dist/demos "$OUT/demo/demos"
mkdir -p "$OUT/todo" "$OUT/todo-server"
cp -R examples/apps/todo-surface-auth/dist/. "$OUT/todo"
cp examples/apps/todo-surface-auth/server/*.mjs "$OUT/todo-server"

printf 'Built deployment artifacts:\n  %s/website\n  %s/demo\n  %s/todo\n  %s/todo-server\n' "$OUT" "$OUT" "$OUT" "$OUT"
