import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/modules/purchase-orders/receive-item.integration.ts",
      "src/modules/sales-orders/allocate.integration.ts",
      "src/modules/picking/pick.integration.ts",
    ],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
