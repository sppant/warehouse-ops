import { eq } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { warehouses } from "../src/db/schema.js";
import { warehouseService } from "../src/modules/warehouses/warehouse.service.js";
import { productService } from "../src/modules/products/product.service.js";
import { purchaseOrderService } from "../src/modules/purchase-orders/purchase-order.service.js";
import { salesOrderService } from "../src/modules/sales-orders/sales-order.service.js";
import { pickTaskService } from "../src/modules/picking/pick-task.service.js";
import { cycleCountService } from "../src/modules/cycle-counts/cycle-count.service.js";

// Seeds demo data through the real services, so stock, reservations and
// movements stay consistent. Safe to re-run: it does nothing once the demo
// warehouse exists.

const DEMO_WAREHOUSE_CODE = "DC-01";
const day = 24 * 60 * 60 * 1000;

const existing = await db
  .select({ id: warehouses.id })
  .from(warehouses)
  .where(eq(warehouses.code, DEMO_WAREHOUSE_CODE))
  .limit(1);

if (existing[0]) {
  console.log("Demo data already present, nothing to do.");
  process.exit(0);
}

const warehouse = await warehouseService.create({
  code: DEMO_WAREHOUSE_CODE,
  name: "Central Distribution Center",
});

const locationDefs = [
  ["A-01-01", "Aisle A, Rack 1, Shelf 1"],
  ["A-01-02", "Aisle A, Rack 1, Shelf 2"],
  ["A-02-01", "Aisle A, Rack 2, Shelf 1"],
  ["B-01-01", "Aisle B, Rack 1, Shelf 1"],
  ["B-02-01", "Aisle B, Rack 2, Shelf 1"],
  ["B-03-04", "Aisle B, Rack 3, Shelf 4"],
  ["C-01-01", "Aisle C, Bulk Storage"],
  ["DOCK-01", "Receiving Dock"],
] as const;

const loc: Record<string, string> = {};
for (const [code, name] of locationDefs) {
  const created = await warehouseService.createLocation(warehouse.id, { code, name });
  loc[code] = created.id;
}

const productDefs = [
  ["WID-1001", "Steel Widget, Small", 2.4, 45, "Zinc-plated steel widget, 25 mm"],
  ["WID-1002", "Steel Widget, Large", 4.1, 120, "Zinc-plated steel widget, 60 mm"],
  ["BLT-2001", "Hex Bolt M8 (box of 100)", 12.5, 900, "Grade 8.8 hex bolts"],
  ["NUT-2002", "Hex Nut M8 (box of 100)", 8.75, 600, "Matching M8 nuts"],
  ["GLV-3001", "Work Gloves, Pair", 6.2, 160, "Cut-resistant work gloves"],
  ["HLM-3002", "Safety Helmet", 18.9, 350, "EN 397 hard hat"],
  ["TPE-4001", "Packing Tape Roll", 1.85, 220, "48 mm x 100 m"],
  ["BOX-4002", "Shipping Carton 40x30x30", 2.1, 480, "Double-wall carton"],
  ["PAL-5001", "Euro Pallet", 14.0, 25000, "EPAL 1200x800"],
  ["LBL-6001", "Thermal Label Roll", 5.4, 300, "100x150 mm, 500 labels"],
  ["SCN-7001", "Handheld Barcode Scanner", 96.0, 420, "2D wireless scanner"],
  ["BAT-7002", "Scanner Battery Pack", 22.0, 90, "Spare battery for SCN-7001"],
] as const;

const prod: Record<string, string> = {};
for (const [sku, name, unitCost, unitWeightGrams, description] of productDefs) {
  const created = await productService.create({ sku, name, unitCost, unitWeightGrams, description });
  prod[sku] = created.id;
}

const cost = (sku: string) => productDefs.find((p) => p[0] === sku)![2];

const createPo = async (
  orderNumber: string,
  supplier: string,
  expectedInDays: number,
  lines: Array<[string, number]>,
) =>
  purchaseOrderService.create({
    orderNumber,
    supplier,
    expectedAt: new Date(Date.now() + expectedInDays * day).toISOString(),
    items: lines.map(([sku, orderedQuantity]) => ({
      productId: prod[sku]!,
      orderedQuantity,
      unitCost: cost(sku),
    })),
  });

const receive = async (
  po: Awaited<ReturnType<typeof createPo>>,
  sku: string,
  location: string,
  quantity: number,
) => {
  const item = po.items.find((i) => i.productId === prod[sku])!;
  await purchaseOrderService.receiveItem({
    purchaseOrderItemId: item.id,
    locationId: loc[location]!,
    quantity,
    reason: `Received against ${po.orderNumber}`,
  });
};

// Purchase orders: one fully received, one partial, one on the way, one draft.
const po1 = await createPo("PO-1001", "Northwind Industrial Supply", -7, [
  ["WID-1001", 500], ["WID-1002", 300], ["BLT-2001", 200], ["NUT-2002", 200],
  ["GLV-3001", 150], ["HLM-3002", 80],
]);
await purchaseOrderService.updateStatus(po1.id, { status: "ORDERED" });
await receive(po1, "WID-1001", "A-01-01", 300);
await receive(po1, "WID-1001", "A-01-02", 200);
await receive(po1, "WID-1002", "A-02-01", 300);
await receive(po1, "BLT-2001", "B-01-01", 200);
await receive(po1, "NUT-2002", "B-01-01", 200);
await receive(po1, "GLV-3001", "B-02-01", 150);
await receive(po1, "HLM-3002", "B-02-01", 80);

const po2 = await createPo("PO-1002", "PackRight Ltd", -3, [
  ["TPE-4001", 400], ["BOX-4002", 600], ["LBL-6001", 250], ["PAL-5001", 40],
]);
await purchaseOrderService.updateStatus(po2.id, { status: "ORDERED" });
await receive(po2, "TPE-4001", "B-03-04", 400);
await receive(po2, "BOX-4002", "C-01-01", 350); // 250 still outstanding
await receive(po2, "LBL-6001", "B-03-04", 250);

const po3 = await createPo("PO-1003", "ScanTech Systems", 5, [
  ["SCN-7001", 25], ["BAT-7002", 50],
]);
await purchaseOrderService.updateStatus(po3.id, { status: "ORDERED" });

await createPo("PO-1004", "Northwind Industrial Supply", 14, [
  ["WID-1001", 400], ["BLT-2001", 150],
]);

// Customer orders at every stage of the flow.
const createSo = (orderNumber: string, customer: string, lines: Array<[string, number]>) =>
  salesOrderService.create({
    orderNumber,
    customer,
    items: lines.map(([sku, orderedQuantity]) => ({ productId: prod[sku]!, orderedQuantity })),
  });

const pickAll = async (salesOrderId: string) => {
  const task = await pickTaskService.generate(salesOrderId);
  const full = await pickTaskService.get(task.id);
  for (const item of full.items) {
    await pickTaskService.pick({ pickTaskItemId: item.id, quantity: item.quantity });
  }
};

await createSo("SO-2001", "Acme Fabrication", [["WID-1001", 40], ["BLT-2001", 10]]); // pending

const so2 = await createSo("SO-2002", "Globex Construction", [["HLM-3002", 20], ["GLV-3001", 20]]);
await salesOrderService.allocate(so2.id); // allocated, ready for a pick task

const so3 = await createSo("SO-2003", "Initech Logistics", [["TPE-4001", 60], ["BOX-4002", 100], ["LBL-6001", 40]]);
await salesOrderService.allocate(so3.id);
await pickTaskService.generate(so3.id); // open pick task to work in the Picking page

const so4 = await createSo("SO-2004", "Umbrella Retail", [["WID-1002", 80], ["NUT-2002", 30]]);
await salesOrderService.allocate(so4.id);
await pickAll(so4.id); // fully picked, ready to pack

const so5 = await createSo("SO-2005", "Stark Manufacturing", [["BLT-2001", 25], ["NUT-2002", 25]]);
await salesOrderService.allocate(so5.id);
await pickAll(so5.id);
await salesOrderService.pack(so5.id); // packed, ready to ship

const so6 = await createSo("SO-2006", "Wayne Enterprises", [["GLV-3001", 30], ["HLM-3002", 15]]);
await salesOrderService.allocate(so6.id);
await pickAll(so6.id);
await salesOrderService.pack(so6.id);
await salesOrderService.ship(so6.id); // shipped

// Cycle counts: one waiting for review, one approved, one rejected.
await cycleCountService.record({
  productId: prod["WID-1001"]!, locationId: loc["A-01-01"]!, countedQuantity: 288,
  reason: "Quarterly count, 12 units short",
});
const approved = await cycleCountService.record({
  productId: prod["GLV-3001"]!, locationId: loc["B-02-01"]!, countedQuantity: 118,
  reason: "Found 2 extra pairs after re-shelving",
});
await cycleCountService.approve(approved.id);
const rejected = await cycleCountService.record({
  productId: prod["TPE-4001"]!, locationId: loc["B-03-04"]!, countedQuantity: 100,
  reason: "Miscount, recount pending",
});
await cycleCountService.reject(rejected.id);

console.log("Demo data created.");
process.exit(0);
