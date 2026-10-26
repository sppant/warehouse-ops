import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/modules/purchase-orders/receive-item.integration.ts",
      "src/modules/sales-orders/allocate.integration.ts",
      "src/modules/picking/pick.integration.ts",
      "src/modules/inventory/inventory-overview.integration.ts",
      "src/modules/inventory/inventory-summary.integration.ts",
      "src/modules/inventory/inventory-flag.integration.ts",
      "src/contract/*.integration.ts",
    ],
    // Files share one database and the summary test diffs against a baseline,
    // so concurrent files that write stock movements make it flaky.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
