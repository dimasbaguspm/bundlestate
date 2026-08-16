#!/usr/bin/env bash
set -euo pipefail

# Devcontainer bootstrap: enable corepack, activate the lockfile pnpm version,
# then install dependencies.
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install