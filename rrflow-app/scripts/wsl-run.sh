#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/devcontainers/.local/share/fnm/node-versions/v22.23.3/installation/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.."
exec pnpm "$@"

