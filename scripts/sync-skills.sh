#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPERPOWERS_DIR="$ROOT_DIR/../superpowers"
TARGET_DIR="$ROOT_DIR/skills"

echo "Syncing Superpowers skills..."

if [[ ! -d "$SUPERPOWERS_DIR/skills" ]]; then
  echo "Error: Superpowers not found at $SUPERPOWERS_DIR" >&2
  exit 1
fi

# Remove old skills
rm -rf "$TARGET_DIR"

# Copy fresh skills
cp -r "$SUPERPOWERS_DIR/skills" "$TARGET_DIR"

echo "✓ Skills synced successfully!"
echo "Skills directory: $TARGET_DIR"
ls -1 "$TARGET_DIR"