#!/bin/sh
# Create the next migration file as migrations/<NNNN>_<kebab-case-name>.sql.
set -eu

name="${1:-${MIGRATION_NAME:-}}"
if [ -z "$name" ]; then
  echo "Usage: create-migration.sh <description> (or set MIGRATION_NAME)" >&2
  exit 2
fi

migrations_dir="$(dirname "$0")/../migrations"
slug="$(printf '%s' "$name" | tr '[:upper:]_ ' '[:lower:]--' | tr -cd '[:alnum:]-' | tr -s '-' | sed 's/^-//; s/-$//')"
if [ -z "$slug" ]; then
  echo "Migration description must contain letters or digits." >&2
  exit 2
fi
# Strip the zero padding so shell arithmetic does not read e.g. 0008 as octal.
last="$(ls "$migrations_dir" | sed -n 's/^\([0-9]\{4\}\)_.*\.sql$/\1/p' | sort | tail -n 1 | sed 's/^0*//')"
next="$(printf '%04d' $((${last:-0} + 1)))"
file="$migrations_dir/${next}_${slug}.sql"

touch "$file"
echo "Created $file"
