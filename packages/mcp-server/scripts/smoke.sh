#!/usr/bin/env bash
# Smoke check: starts a fake API, then uses the MCP Inspector CLI to confirm the
# built server lists its tools and answers calls (including a tool error).
# Needs network once, for `npx` to fetch the Inspector. Run `npm run build` first.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${SMOKE_PORT:-3999}"
TOKEN="smoke-test-token"

[ -f dist/index.js ] || { echo "dist/index.js missing: run npm run build -w packages/mcp-server" >&2; exit 1; }

node scripts/fake-api.mjs "$PORT" 2>/dev/null &
FAKE_PID=$!
trap 'kill $FAKE_PID 2>/dev/null || true' EXIT
sleep 1

inspect() {
  npx -y @modelcontextprotocol/inspector --cli \
    -e "WAREHOUSE_API_URL=http://localhost:$PORT" -e "WAREHOUSE_API_TOKEN=$TOKEN" \
    node dist/index.js --method "$@" 2>/dev/null
}

# check <label> <node expression over parsed JSON `r`> <command...>
check() {
  local label="$1" expr="$2"; shift 2
  # The Inspector exits non-zero and appends an error line when a tool returns
  # isError, so keep only the first (pretty-printed) JSON document.
  local out; out="$("$@" | awk '/^}$/{print; exit} 1' || true)"
  if echo "$out" | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); process.exit(($expr)?0:1)"; then
    echo "PASS  $label"
  else
    echo "FAIL  $label"; echo "$out"; exit 1
  fi
}

check "tools/list shows the 4 tools" \
  "r.tools.map(t=>t.name).sort().join()==='get_item_movements,get_stock_level,list_low_stock,search_items' && r.tools.every(t=>t.annotations.readOnlyHint)" \
  inspect tools/list

check "search_items finds Bolt M8" \
  "!r.isError && r.structuredContent.items[0].sku==='BOLT-M8'" \
  inspect tools/call --tool-name search_items --tool-arg query=bolt

check "get_stock_level totals" \
  "!r.isError && r.structuredContent.totals.available===4" \
  inspect tools/call --tool-name get_stock_level --tool-arg sku=BOLT-M8

check "list_low_stock returns only the low row" \
  "!r.isError && r.structuredContent.items.length===1 && r.structuredContent.items[0].sku==='BOLT-M8'" \
  inspect tools/call --tool-name list_low_stock

check "get_item_movements honours limit" \
  "!r.isError && r.structuredContent.movements.length===2 && r.structuredContent.total===3" \
  inspect tools/call --tool-name get_item_movements --tool-arg sku=BOLT-M8 --tool-arg limit=2

check "unknown SKU is a tool error, not a crash" \
  "r.isError===true" \
  inspect tools/call --tool-name get_stock_level --tool-arg sku=NOPE

check "invalid input (limit 999) is rejected" \
  "r.isError===true" \
  inspect tools/call --tool-name search_items --tool-arg query=bolt --tool-arg limit=999

echo "All smoke checks passed."
