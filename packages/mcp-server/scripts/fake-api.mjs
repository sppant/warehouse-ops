// Tiny stand-in for the Warehouse Ops API so the MCP server can be smoke
// tested without Postgres. Usage: node scripts/fake-api.mjs [port]
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3999);
const loc = "11111111-1111-4111-8111-111111111111";

const rows = [
  ["WIDGET-1", "Widget", 0, 0, "OUT_OF_STOCK"],
  ["BOLT-M8", "Bolt M8", 6, 4, "LOW_STOCK"],
  ["PALLET-WRAP", "Pallet wrap", 120, 100, "IN_STOCK"],
].map(([sku, productName, onHand, available, status], i) => ({
  id: `inv-${i}`,
  productId: `p-${i}`,
  sku,
  productName,
  locationId: loc,
  locationCode: "A-01",
  warehouseCode: "MAIN",
  onHand,
  reserved: onHand - available,
  damaged: 0,
  available,
  status,
  lastMovementAt: "2026-01-02T03:04:05.000Z",
  cycleCountFlaggedAt: null,
}));

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  if (url.pathname === "/api/inventory/overview") {
    const search = (q.get("search") ?? "").toLowerCase();
    let data = rows.filter(
      (r) => !search || r.sku.toLowerCase().includes(search) || r.productName.toLowerCase().includes(search),
    );
    if (q.get("status")) data = data.filter((r) => r.status === q.get("status"));
    if (q.get("sortBy") === "available") data = [...data].sort((a, b) => a.available - b.available);
    return send(res, 200, {
      data,
      meta: { page: 1, pageSize: Number(q.get("pageSize") ?? 25), total: data.length, totalPages: 1 },
    });
  }

  if (url.pathname === "/api/products") {
    return send(res, 200, { data: rows.map((r) => ({ id: r.productId, sku: r.sku, name: r.productName })) });
  }

  if (url.pathname === "/api/inventory/movements") {
    const n = (i) => ({
      id: `m-${i}`, type: i === 3 ? "RECEIPT" : "PICK", quantity: i, locationCode: "A-01",
      reason: null, referenceType: null, referenceId: null, createdAt: `2026-01-0${i}T00:00:00.000Z`,
    });
    return send(res, 200, { data: [n(3), n(2), n(1)] });
  }

  if (url.pathname === "/health") return send(res, 200, { status: "ok" });
  send(res, 404, { error: "Not found" });
}).listen(port, () => console.error(`fake API on http://localhost:${port}`));
