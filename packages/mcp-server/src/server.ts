import { McpServer } from "@modelcontextprotocol/server";
import type { WarehouseApiClient } from "./api-client.js";
import { registerGetItemMovements } from "./tools/get-item-movements.js";
import { registerGetStockLevel } from "./tools/get-stock-level.js";
import { registerListLowStock } from "./tools/list-low-stock.js";
import { registerSearchItems } from "./tools/search-items.js";

export const createServer = (client: WarehouseApiClient) => {
  const server = new McpServer({ name: "warehouse-ops", version: "0.1.0" });

  registerSearchItems(server, client);
  registerGetStockLevel(server, client);
  registerListLowStock(server, client);
  registerGetItemMovements(server, client);

  return server;
};
