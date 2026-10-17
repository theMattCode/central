#!/bin/sh
# Fail when a migration does not follow migrations/<NNNN>_<kebab-case-name>.sql.
set -eu

migrations_dir="$(dirname "$0")/../migrations"
invalid="$(ls "$migrations_dir" | grep -Ev '^[0-9]{4}_[a-z0-9]+(-[a-z0-9]+)*\.sql$' || true)"
if [ -n "$invalid" ]; then
  echo "Migrations must be named <NNNN>_<kebab-case-name>.sql:" >&2
  echo "$invalid" >&2
  exit 1
fi

duplicates="$(ls "$migrations_dir" | cut -c1-4 | uniq -d)"
if [ -n "$duplicates" ]; then
  echo "Duplicate migration numbers: $duplicates" >&2
  exit 1
fi
