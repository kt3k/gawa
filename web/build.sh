#!/bin/sh
# Compiles web/mod.ts to web/dist/mod.js + mod.d.ts (committed, so the
# package can be installed straight from git: npm i github:kt3k/gawa#vX.Y.Z).
set -e
cd "$(dirname "$0")"
rm -rf dist
deno run -A npm:typescript@5.6.3/tsc mod.ts \
  --outDir dist --declaration --target es2020 --module es2020 \
  --lib es2020,dom --strict --removeComments false
