#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
REFERENCE_ROOT="${PROJECT_ROOT}/public-reference/fc26companion"
REVISION="0e1d32a87c9947be681803cd506bc543f912cfd8"

command -v node >/dev/null || { echo "Node.js 20+ is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
command -v git >/dev/null || { echo "git is required." >&2; exit 1; }

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22+ is required; found $(node --version)." >&2
  exit 1
fi

mkdir -p "${PROJECT_ROOT}/public-reference"
if [ -d "${REFERENCE_ROOT}/.git" ]; then
  git -C "${REFERENCE_ROOT}" fetch --quiet origin
else
  git clone https://github.com/ismailoksuz/EAFC26-DataHub.git "${REFERENCE_ROOT}"
fi
git -C "${REFERENCE_ROOT}" checkout --quiet "${REVISION}"

cd "${PROJECT_ROOT}"
npm ci
(cd "${REFERENCE_ROOT}" && npm ci)
cp -n config.example.json config.json 2>/dev/null || true
npm run build:web

echo "Setup complete. Start with: npm run dev"
