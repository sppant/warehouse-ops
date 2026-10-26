import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { productRoutes } from "./modules/products/product.routes.js";
import { warehouseRoutes } from "./modules/warehouses/warehouse.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { purchaseOrderRoutes } from "./modules/purchase-orders/purchase-order.routes.js";
import { salesOrderRoutes } from "./modules/sales-orders/sales-order.routes.js";
import { pickTaskRoutes } from "./modules/picking/pick-task.routes.js";
import { cycleCountRoutes } from "./modules/cycle-counts/cycle-count.routes.js";
import { configRoutes } from "./modules/config/config.routes.js";
import { readFeatureFlags, type FeatureFlags } from "./config/flags.js";
import { openApiDocument } from "./openapi/document.js";

export type AppOptions = {
  // Defaults to FEATURE_FLAGS from the environment (all off when unset).
  flags?: FeatureFlags;
};

export const buildApp = ({ flags = readFeatureFlags() }: AppOptions = {}) => {
  const app = Fastify({
    logger: false,
  });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  app.register(helmet);
  app.register(productRoutes);
  app.register(warehouseRoutes);
  app.register(inventoryRoutes);
  app.register(purchaseOrderRoutes);
  app.register(salesOrderRoutes);
  app.register(pickTaskRoutes);
  app.register(cycleCountRoutes);
  app.register(configRoutes, { flags });

  app.get("/api/openapi.json", async () => openApiDocument);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  return app;
};
