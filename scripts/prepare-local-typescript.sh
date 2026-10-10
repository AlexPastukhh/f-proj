#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GLOBAL="$(npm root -g)/typescript"
mkdir -p "$ROOT/node_modules"
if [ ! -e "$ROOT/node_modules/typescript" ]; then ln -s "$GLOBAL" "$ROOT/node_modules/typescript"; fi
