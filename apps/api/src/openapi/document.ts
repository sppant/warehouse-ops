import { buildDocument, type Operation } from "./define.js";
import { metaOperations } from "./meta.openapi.js";
import { inventoryOperations } from "../modules/inventory/inventory.openapi.js";
import { warehouseOperations } from "../modules/warehouses/warehouse.openapi.js";
import { purchaseOrderOperations } from "../modules/purchase-orders/purchase-order.openapi.js";
import { salesOrderOperations } from "../modules/sales-orders/sales-order.openapi.js";
import { pickTaskOperations } from "../modules/picking/pick-task.openapi.js";
import { productOperations } from "../modules/products/product.openapi.js";

const operations: Operation[] = [
  ...metaOperations,
  ...productOperations,
  ...inventoryOperations,
  ...warehouseOperations,
  ...purchaseOrderOperations,
  ...salesOrderOperations,
  ...pickTaskOperations,
];

export const openApiDocument = buildDocument(operations, {
  title: "Warehouse Ops API",
  version: "1.0.0",
  description:
    "Generated from the Zod schemas in apps/api (code-first). Run `npm run openapi:generate -w apps/api` after changing an endpoint.",
});
