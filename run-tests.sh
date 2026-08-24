#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
elif [ -x "/mnt/c/Program Files/nodejs/node.exe" ]; then
  NODE_BIN="/mnt/c/Program Files/nodejs/node.exe"
else
  echo "node not found" >&2
  exit 1
fi

echo "== unit tests =="
"$NODE_BIN" --import ./tests/register.mjs tests/run.mjs

echo ""
echo "== integration (headless races) =="
"$NODE_BIN" --import ./tests/register.mjs tests/smoke.mjs 2>&1 | grep -v "THREE.Material"
