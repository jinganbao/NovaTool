#!/usr/bin/env bash
set -euo pipefail

echo "[quality] typecheck"
pnpm typecheck

echo "[quality] lint"
pnpm lint

echo "[quality] tests"
pnpm test -- --run

echo "[quality] frontend build"
pnpm build

echo "[quality] rust check"
cargo check --manifest-path src-tauri/Cargo.toml

echo "[quality] all checks passed"
