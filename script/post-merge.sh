#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Use the merged lockfile; never change dependency versions during setup.
npm ci --no-audit --no-fund
npm run build

# Database changes require a reviewed migration, not an automatic schema push.
# Workflow reconciliation restarts the application after this script succeeds.