#!/bin/sh
# Bundles the example page script into examples/web/www/main.js.
set -e
cd "$(dirname "$0")"
deno bundle --platform=browser -o www/main.js src/main.ts
